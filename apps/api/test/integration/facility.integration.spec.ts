/**
 * HTTP integration: facility booking happy path.
 * Resident books an auto-confirm facility; deposit is recorded and booking is CONFIRMED.
 */
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

function nextBookingSlot(startHour = 10, durationMin = 60) {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: facility booking', () => {
  let app: INestApplication;
  let fx: IntegrationFixtures;

  beforeAll(async () => {
    const { createTestApp } = await import('../helpers/create-test-app');
    const { seedIntegrationFixtures } = await import('../helpers/integration-fixtures');
    const boot = await createTestApp();
    app = boot.app;
    fx = await seedIntegrationFixtures(boot.prisma, app);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('resident books a facility with deposit — booking confirmed and deposit linked', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const adminHeaders = authHeaders(fx.tokens.admin, fx.condoId);
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);
    const slot = nextBookingSlot();

    const facilityRes = await supertest(server)
      .post('/api/facilities')
      .set(adminHeaders)
      .send({
        condoId: fx.condoId,
        name: 'Integration BBQ Pit',
        depositAmount: 50,
        openTime: '08:00',
        closeTime: '22:00',
        slotMinutes: 60,
      })
      .expect(201);

    const facility = facilityRes.body.data ?? facilityRes.body;
    expect(facility.id).toBeTruthy();

    const bookRes = await supertest(server)
      .post('/api/bookings')
      .set(ownerHeaders)
      .send({
        facilityId: facility.id,
        unitId: fx.unitId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      })
      .expect(201);

    const booking = bookRes.body.data ?? bookRes.body;
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.depositId ?? booking.depositHeld).toBeTruthy();
  });

  it('resident books a free facility — auto-confirmed without deposit', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const adminHeaders = authHeaders(fx.tokens.admin, fx.condoId);
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);
    const slot = nextBookingSlot(14);

    const facilityRes = await supertest(server)
      .post('/api/facilities')
      .set(adminHeaders)
      .send({
        condoId: fx.condoId,
        name: 'Integration Gym Slot',
        openTime: '08:00',
        closeTime: '22:00',
        slotMinutes: 60,
      })
      .expect(201);

    const facility = facilityRes.body.data ?? facilityRes.body;

    const bookRes = await supertest(server)
      .post('/api/bookings')
      .set(ownerHeaders)
      .send({
        facilityId: facility.id,
        unitId: fx.unitId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      })
      .expect(201);

    const booking = bookRes.body.data ?? bookRes.body;
    expect(booking.status).toBe('CONFIRMED');
    expect(Number(booking.depositHeld ?? 0)).toBe(0);
  });
});
