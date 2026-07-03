import type { INestApplication } from '@nestjs/common';
import { RoleId, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { TEST_PASSWORD, authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import { seedIntegrationFixtures, signInToken } from '../helpers/integration-fixtures';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

async function seedSuperAdmin(
  prisma: PrismaService,
  app: INestApplication,
): Promise<{ email: string; token: string }> {
  const argon2 = await import('argon2');
  const passwordHash = await argon2.default.hash(TEST_PASSWORD);
  const email = 'integration-superadmin@test.local';

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: {
      email,
      name: 'Integration Super Admin',
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.roleAssignment.deleteMany({
    where: { userId: user.id, roleId: RoleId.SUPER_ADMIN },
  });
  await prisma.roleAssignment.create({
    data: { userId: user.id, roleId: RoleId.SUPER_ADMIN },
  });

  const token = await signInToken(app, email);
  return { email, token };
}

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: platform console', () => {
  let app: INestApplication;
  let fx: IntegrationFixtures;
  let superAdminToken: string;

  beforeAll(async () => {
    const { createTestApp } = await import('../helpers/create-test-app');
    const boot = await createTestApp();
    app = boot.app;
    fx = await seedIntegrationFixtures(boot.prisma, app);
    const superAdmin = await seedSuperAdmin(boot.prisma, app);
    superAdminToken = superAdmin.token;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/platform/condos lists condos for SUPER_ADMIN (paginated)', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get('/api/platform/condos?limit=10&offset=0')
      .set(authHeaders(superAdminToken))
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(Array.isArray(payload.items)).toBe(true);
    expect(typeof payload.total).toBe('number');
    expect(payload.items.some((row: { id: string }) => row.id === fx.condoId)).toBe(true);
  });

  it('GET /api/platform/condos/:id/health returns health payload', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get(`/api/platform/condos/${fx.condoId}/health`)
      .set(authHeaders(superAdminToken))
      .expect(200);

    const health = res.body.data ?? res.body;
    expect(health.condoId).toBe(fx.condoId);
  });

  it('POST /api/platform/condos provisions a new condo (201)', async () => {
    const supertest = (await import('supertest')).default;
    const slug = `platform-it-${Date.now()}`;
    const res = await supertest(app.getHttpServer())
      .post('/api/platform/condos')
      .set(authHeaders(superAdminToken))
      .send({
        name: 'Platform Integration Condo',
        slug,
        address: '99 Integration Way, Kuala Lumpur',
        timezone: 'Asia/Kuala_Lumpur',
      })
      .expect(201);

    const created = res.body.data ?? res.body;
    expect(created.slug).toBe(slug);
    expect(created.id).toBeTruthy();
  });

  it('GET /api/platform/condos returns 403 for non-admin users', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .get('/api/platform/condos')
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(403);
  });
});
