/**
 * Integration: visitor HTTP flows.
 *
 * Covers:
 * - Delivery pass QR payload shape
 * - Guard walk-in with admitNow (immediate check-in)
 * - Walk-in owner approval: guard registers pending visitor, owner approves (condo policy)
 */
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: visitors', () => {
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

  it('POST /api/visitors/delivery-pass returns a QR payload in condo:visitor:code shape', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/visitors/delivery-pass')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .send({
        unitId: fx.unitId,
        passKind: 'DELIVERY',
        platform: 'GRABFOOD',
        expectedAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .expect(201);

    const visitor = res.body.data ?? res.body;
    expect(visitor.qrPayload).toBeTruthy();
    const parts = String(visitor.qrPayload).split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(fx.condoId);
    expect(parts[2]).toMatch(/^[A-Z0-9]+$/);
  });

  it('POST /api/visitors/walk-in/unit with admitNow still checks in immediately (guard admit)', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/visitors/walk-in/unit')
      .set(authHeaders(fx.tokens.guard, fx.condoId))
      .send({
        unitId: fx.unitId,
        name: 'Walk-in Guest',
        phone: '+60123456789',
        admitNow: true,
      })
      .expect(201);

    const visitor = res.body.data ?? res.body;
    expect(visitor.status).toBe('CHECKED_IN');
    expect(visitor.metadata?.guardAdmittedAt ?? visitor.metadata?.admissionSource).toBeTruthy();
  });

  it('POST /api/visitors/walk-in/unit without admitNow awaits owner approval, then owner approves', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const walkInRes = await supertest(server)
      .post('/api/visitors/walk-in/unit')
      .set(authHeaders(fx.tokens.guard, fx.condoId))
      .send({
        unitId: fx.unitId,
        name: 'Pending Walk-in Guest',
        phone: '+60198765432',
      })
      .expect(201);

    const pending = walkInRes.body.data ?? walkInRes.body;
    expect(pending.status).toBe('PENDING_OWNER_APPROVAL');
    expect(pending.approvalDeadline).toBeTruthy();

    const approveRes = await supertest(server)
      .post(`/api/visitors/${pending.id}/approve`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(201);

    const approved = approveRes.body.data ?? approveRes.body;
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedAt).toBeTruthy();
  });
});
