import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_PASSWORD, authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import { signInToken } from '../helpers/integration-fixtures';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: PDPA account deletion', () => {
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

  async function createDisposableUser(label: string) {
    const argon2 = await import('argon2');
    const { RoleId, UserStatus } = await import('@prisma/client');
    const { PrismaService } = await import('../../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const email = `pdpa-delete-${label}-${stamp}@example.com`;
    const passwordHash = await argon2.default.hash(TEST_PASSWORD);
    const user = await prisma.user.create({
      data: {
        email,
        name: `PDPA Delete ${label}`,
        phone: `+6011${stamp.slice(-8).padStart(8, '0')}`,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        roleId: RoleId.SECURITY_GUARD,
        condoId: fx.condoId,
      },
    });
    const token = await signInToken(app, email, TEST_PASSWORD);
    return { user, token, email };
  }

  it('DELETE /api/users/me rejects missing confirmation phrase', async () => {
    const disposable = await createDisposableUser('confirm-missing');
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .delete('/api/users/me')
      .set(authHeaders(disposable.token, fx.condoId))
      .send({})
      .expect(400);
  });

  it('DELETE /api/users/me rejects wrong confirmation phrase', async () => {
    const disposable = await createDisposableUser('confirm-wrong');
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .delete('/api/users/me')
      .set(authHeaders(disposable.token, fx.condoId))
      .send({ confirmation: 'please delete' })
      .expect(400);
  });

  it('DELETE /api/users/me anonymizes PII, revokes sessions/roles, writes DELETE audit', async () => {
    const disposable = await createDisposableUser('full');
    const supertest = (await import('supertest')).default;
    const { PrismaService } = await import('../../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    const userId = disposable.user.id;

    const res = await supertest(app.getHttpServer())
      .delete('/api/users/me')
      .set(authHeaders(disposable.token, fx.condoId))
      .send({ confirmation: 'DELETE MY ACCOUNT' })
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(payload.id).toBe(userId);
    expect(payload.status).toBe('deleted');
    expect(payload.deletedAt).toBeTruthy();

    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.status).toBe('DEACTIVATED');
    expect(after.deletedAt).toBeTruthy();
    expect(after.name).toBe('Deleted User');
    expect(after.email).toBe(`deleted+${userId}@invalid.local`);
    expect(after.phone).toBe(`deleted:${userId}`);
    expect(after.passwordHash).toBeNull();
    expect(after.totpSecret).toBeNull();
    expect(after.avatarUrl).toBeNull();

    const activeSessions = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeSessions).toBe(0);

    const activeRoles = await prisma.roleAssignment.count({
      where: { userId, revokedAt: null },
    });
    expect(activeRoles).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorUserId: userId,
        action: 'DELETE',
        resourceType: 'User',
        resourceId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();

    // Token is revoked; a second attempt must not succeed as an active delete.
    await supertest(app.getHttpServer())
      .delete('/api/users/me')
      .set(authHeaders(disposable.token, fx.condoId))
      .send({ confirmation: 'DELETE MY ACCOUNT' })
      .expect(401);
  });

  it('role-based access: unit owner can delete own account with confirmation', async () => {
    const argon2 = await import('argon2');
    const { RoleId, UserStatus } = await import('@prisma/client');
    const { PrismaService } = await import('../../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const email = `pdpa-delete-owner-${stamp}@example.com`;
    const passwordHash = await argon2.default.hash(TEST_PASSWORD);
    const user = await prisma.user.create({
      data: {
        email,
        name: 'PDPA Delete Owner',
        phone: `+6012${stamp.slice(-8).padStart(8, '0')}`,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        roleId: RoleId.UNIT_OWNER,
        condoId: fx.condoId,
        unitId: fx.secondUnitId,
      },
    });
    const token = await signInToken(app, email, TEST_PASSWORD);

    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .delete('/api/users/me')
      .set(authHeaders(token, fx.condoId))
      .send({ confirmation: 'DELETE MY ACCOUNT' })
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(payload.id).toBe(user.id);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.status).toBe('DEACTIVATED');
    expect(after.deletedAt).toBeTruthy();
  });
});
