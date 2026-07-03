import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_PASSWORD, authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: auth', () => {
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

  it('POST /api/auth/sign-in succeeds with valid credentials', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: fx.emails.owner, password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.data?.accessToken ?? res.body.accessToken).toBeTruthy();
  });

  it('POST /api/auth/sign-in rejects invalid credentials', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: fx.emails.owner, password: 'wrong-password' })
      .expect(401);
    expect(res.body.message ?? res.body.error).toBeTruthy();
  });

  it('GET /api/platform/condos returns 401 without a token', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer()).get('/api/platform/condos').expect(401);
  });

  it('role-based access: owner cannot list platform condos', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .get('/api/platform/condos')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(403);
  });

  it('role-based access: guard cannot read billing fund balances', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .get(`/api/billing/reports/condo/${fx.condoId}/fund-balances`)
      .set(authHeaders(fx.tokens.guard, fx.condoId))
      .expect(403);
  });

  it('role-based access: management admin can read billing fund balances', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get(`/api/billing/reports/condo/${fx.condoId}/fund-balances`)
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(Array.isArray(payload)).toBe(true);
  });

  it('lists sessions, revokes another session, and rejects its refresh token', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();

    const first = await supertest(server)
      .post('/api/auth/sign-in')
      .set('User-Agent', 'IntegrationTest/SessionA')
      .send({ email: fx.emails.owner, password: TEST_PASSWORD })
      .expect(200);

    const firstBody = first.body.data ?? first.body;
    const firstRefresh = firstBody.refreshToken as string;
    const firstSessionId = firstBody.sessionId as string;
    expect(firstRefresh).toBeTruthy();
    expect(firstSessionId).toBeTruthy();

    const second = await supertest(server)
      .post('/api/auth/sign-in')
      .set('User-Agent', 'IntegrationTest/SessionB')
      .send({ email: fx.emails.owner, password: TEST_PASSWORD })
      .expect(200);

    const secondBody = second.body.data ?? second.body;
    const secondToken = secondBody.accessToken as string;

    const listRes = await supertest(server)
      .get('/api/auth/sessions')
      .set(authHeaders(secondToken, fx.condoId))
      .expect(200);

    const sessions = listRes.body.data ?? listRes.body;
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.some((s: { id: string }) => s.id === firstSessionId)).toBe(true);

    await supertest(server)
      .delete(`/api/auth/sessions/${firstSessionId}`)
      .set(authHeaders(secondToken, fx.condoId))
      .expect(204);

    await supertest(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefresh })
      .expect(401);

    await supertest(server)
      .get('/api/auth/sessions')
      .set(authHeaders(secondToken, fx.condoId))
      .expect(200);
  });
});
