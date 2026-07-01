import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/create-test-app';
import { ensureIntegrationEnv } from './helpers/integration-env';

const integrationReady = ensureIntegrationEnv();

describe.skipIf(!integrationReady)('API integration (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const boot = await createTestApp();
    app = boot.app;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/auth/sign-in rejects invalid credentials', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401);
    expect(res.body.message ?? res.body.error).toBeTruthy();
  });

  it('GET /api/platform/condos requires authentication', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer()).get('/api/platform/condos').expect(401);
  });

  it('GET /api/lost-found/condo/:id requires authentication', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .get('/api/lost-found/condo/00000000-0000-4000-8000-000000000001')
      .expect(401);
  });
});

describe.skipIf(!integrationReady)('API integration (authenticated)', () => {
  let app: INestApplication;
  let condoId: string;
  let superToken: string;

  beforeAll(async () => {
    const { RoleId, RoleScope, UserStatus } = await import('@prisma/client');
    const argon2 = await import('argon2');
    const supertest = (await import('supertest')).default;
    const boot = await createTestApp();
    app = boot.app;
    const prisma = boot.prisma;

    await prisma.role.createMany({
      data: [
        {
          id: RoleId.SUPER_ADMIN,
          name: 'Platform admin',
          scope: RoleScope.PLATFORM,
          description: 'Integration test role',
        },
      ],
      skipDuplicates: true,
    });

    const passwordHash = await argon2.default.hash('Demo!2026');
    const condo = await prisma.condo.upsert({
      where: { slug: 'integration-test' },
      update: {},
      create: {
        slug: 'integration-test',
        name: 'Integration Test Condo',
        address: '1 Test Street',
        countryCode: 'MY',
        currencyCode: 'MYR',
        timezone: 'Asia/Kuala_Lumpur',
        locale: 'en',
      },
    });
    condoId = condo.id;

    const superUser = await prisma.user.upsert({
      where: { email: 'integration-super@test.local' },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: {
        email: 'integration-super@test.local',
        name: 'Integration Super',
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.roleAssignment.deleteMany({
      where: { userId: superUser.id, roleId: RoleId.SUPER_ADMIN },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: superUser.id,
        roleId: RoleId.SUPER_ADMIN,
        condoId: null,
      },
    });

    const signIn = await supertest(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'integration-super@test.local', password: 'Demo!2026' })
      .expect(200);

    superToken = signIn.body.data?.accessToken ?? signIn.body.accessToken;
    if (!superToken) {
      throw new Error('Sign-in did not return an access token');
    }
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/platform/condos returns condo summaries for SUPER_ADMIN', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get('/api/platform/condos')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const rows = res.body.data ?? res.body;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((row: { id: string }) => row.id === condoId)).toBe(true);
  });

  it('GET /api/lost-found/condo/:id lists posts for authorized users', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get(`/api/lost-found/condo/${condoId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('x-condo-id', condoId)
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(payload.items).toEqual([]);
    expect(payload.total).toBe(0);
  });
});
