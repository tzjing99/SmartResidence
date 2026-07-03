import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_PASSWORD, authHeaders, ensureIntegrationEnv, signInTestIp } from '../helpers/integration-env';
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
      .set('X-Forwarded-For', signInTestIp('auth-sign-in-success'))
      .send({ email: fx.emails.owner, password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.data?.accessToken ?? res.body.accessToken).toBeTruthy();
  });

  it('POST /api/auth/sign-in rejects invalid credentials', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/sign-in')
      .set('X-Forwarded-For', signInTestIp('auth-sign-in-invalid'))
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

    const extra = await supertest(server)
      .post('/api/auth/sign-in')
      .set('X-Forwarded-For', signInTestIp('auth-extra-session'))
      .set('User-Agent', 'IntegrationTest/ExtraSession')
      .send({ email: fx.emails.owner, password: TEST_PASSWORD })
      .expect(200);

    const extraBody = extra.body.data ?? extra.body;
    const extraSessionId = extraBody.sessionId as string;
    const extraRefresh = extraBody.refreshToken as string;
    expect(extraSessionId).toBeTruthy();
    expect(extraRefresh).toBeTruthy();

    const listRes = await supertest(server)
      .get('/api/auth/sessions')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(200);

    const sessions = listRes.body.data ?? listRes.body;
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.some((s: { id: string }) => s.id === extraSessionId)).toBe(true);

    await supertest(server)
      .delete(`/api/auth/sessions/${extraSessionId}`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(204);

    await supertest(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: extraRefresh })
      .expect(401);
  });
});
