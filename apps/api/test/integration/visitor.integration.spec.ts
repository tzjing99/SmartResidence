/**
 * Integration: visitor HTTP flows.
 *
 * Covers:
 * - Delivery pass QR payload shape
 * - Guard walk-in with admitNow (immediate check-in)
 * - Walk-in owner approval: guard registers pending visitor, owner approves (condo policy)
 * - §2.1 RBAC: management cannot approve/reject unit walk-ins; owners cannot gate-operate
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

  it('§2.1: management cannot approve or reject a pending unit walk-in', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const walkInRes = await supertest(server)
      .post('/api/visitors/walk-in/unit')
      .set(authHeaders(fx.tokens.guard, fx.condoId))
      .send({
        unitId: fx.unitId,
        name: 'Mgmt Denied Walk-in',
        phone: '+60111222333',
      })
      .expect(201);

    const pending = walkInRes.body.data ?? walkInRes.body;
    expect(pending.status).toBe('PENDING_OWNER_APPROVAL');

    await supertest(server)
      .post(`/api/visitors/${pending.id}/approve`)
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .expect(403);

    await supertest(server)
      .post(`/api/visitors/${pending.id}/reject`)
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .send({ reason: 'should not work' })
      .expect(403);

    // Owner can still approve after management was denied.
    const approveRes = await supertest(server)
      .post(`/api/visitors/${pending.id}/approve`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(201);
    expect((approveRes.body.data ?? approveRes.body).status).toBe('APPROVED');
  });

  it('§2.1: management cannot register walk-ins or check visitors in', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();

    await supertest(server)
      .post('/api/visitors/walk-in/unit')
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .send({
        unitId: fx.unitId,
        name: 'Admin Walk-in Attempt',
        phone: '+60144555666',
      })
      .expect(403);

    await supertest(server)
      .post('/api/visitors/check-in/not-a-real-pass')
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .send({})
      .expect(403);
  });

  it('§2.1: unit owner cannot perform gate check-in or create walk-ins', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();

    await supertest(server)
      .post('/api/visitors/walk-in/unit')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .send({
        unitId: fx.unitId,
        name: 'Owner Gate Attempt',
        phone: '+60177888999',
      })
      .expect(403);

    await supertest(server)
      .post('/api/visitors/check-in/not-a-real-pass')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .send({})
      .expect(403);
  });

  it('§2.1: management cannot pre-register a visitor for a resident unit', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .post('/api/visitors')
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .send({
        unitId: fx.unitId,
        name: 'Admin Pre-reg Attempt',
        phone: '+60122333444',
        expectedAt: new Date(Date.now() + 3_600_000).toISOString(),
        entryMode: 'WALK_IN',
      })
      .expect(403);
  });

  it('§2.1: unit owner cannot list the condo-wide visitor log', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .get(`/api/visitors/condo/${fx.condoId}`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(403);
  });
});
