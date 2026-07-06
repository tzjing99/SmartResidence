import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: PDPA user data export', () => {
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

  it('POST /api/users/me/export returns export metadata for unit owner', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/users/me/export')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(201);

    const payload = res.body.data ?? res.body;
    expect(payload.exportId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(payload.status).toBe('ready');
    expect(payload.id).toBe(fx.userIds.owner);
  });

  it('GET /api/users/me/export/:id downloads JSON bundle with profile and units', async () => {
    const supertest = (await import('supertest')).default;
    const created = await supertest(app.getHttpServer())
      .post('/api/users/me/export')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(201);

    const { exportId } = (created.body.data ?? created.body) as { exportId: string };

    const res = await supertest(app.getHttpServer())
      .get(`/api/users/me/export/${exportId}`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.profile).toBeTruthy();
    expect(res.body.profile.id).toBe(fx.userIds.owner);
    expect(res.body.profile).not.toHaveProperty('passwordHash');
    expect(res.body.profile).not.toHaveProperty('totpSecret');
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.units.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.roleAssignments)).toBe(true);
    expect(Array.isArray(res.body.threads)).toBe(true);
    expect(Array.isArray(res.body.invoices)).toBe(true);
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(Array.isArray(res.body.visitors)).toBe(true);
  });

  it('POST /api/users/me/export writes an EXPORT audit log entry', async () => {
    const supertest = (await import('supertest')).default;
    const { PrismaService } = await import('../../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);

    await supertest(app.getHttpServer())
      .post('/api/users/me/export')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(201);

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorUserId: fx.userIds.owner,
        action: 'EXPORT',
        resourceType: 'User',
        resourceId: fx.userIds.owner,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  it('role-based access: guard can export own personal data', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/users/me/export')
      .set(authHeaders(fx.tokens.guard, fx.condoId))
      .expect(201);

    const payload = res.body.data ?? res.body;
    expect(payload.id).toBe(fx.userIds.guard);
  });

  it('GET /api/users/me/export/:id rejects another user export id', async () => {
    const supertest = (await import('supertest')).default;
    const created = await supertest(app.getHttpServer())
      .post('/api/users/me/export')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(201);

    const { exportId } = (created.body.data ?? created.body) as { exportId: string };

    await supertest(app.getHttpServer())
      .get(`/api/users/me/export/${exportId}`)
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .expect(404);
  });
});
