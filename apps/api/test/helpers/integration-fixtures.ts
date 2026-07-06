import type { INestApplication } from '@nestjs/common';
import { RoleId, RoleScope, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { TEST_PASSWORD, signInTestIp } from './integration-env';
import type { IntegrationFixtures } from './integration-types';

export type { IntegrationFixtures };
export { TEST_PASSWORD };

const ROLE_SEED = [
  { id: RoleId.SUPER_ADMIN, name: 'Platform admin', scope: RoleScope.PLATFORM },
  { id: RoleId.MANAGEMENT_ADMIN, name: 'Management admin', scope: RoleScope.CONDO },
  { id: RoleId.MANAGEMENT_STAFF, name: 'Management staff', scope: RoleScope.CONDO },
  { id: RoleId.SECURITY_GUARD, name: 'Security guard', scope: RoleScope.CONDO },
  { id: RoleId.UNIT_OWNER, name: 'Unit owner', scope: RoleScope.UNIT },
  { id: RoleId.TENANT, name: 'Tenant', scope: RoleScope.UNIT },
  { id: RoleId.HOUSEHOLD_MEMBER, name: 'Household member', scope: RoleScope.UNIT },
  { id: RoleId.CONTRACTOR, name: 'Contractor', scope: RoleScope.CONDO },
] as const;

/** Idempotent seed for integration / regression suites (@requires-db). */
export async function seedIntegrationFixtures(
  prisma: PrismaService,
  app: INestApplication,
): Promise<IntegrationFixtures> {
  const argon2 = await import('argon2');
  const passwordHash = await argon2.default.hash(TEST_PASSWORD);

  await prisma.role.createMany({
    data: ROLE_SEED.map((r) => ({ ...r, description: 'Integration test role' })),
    skipDuplicates: true,
  });

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
      settings: {
        visitor: {
          walkInRequireOwnerApproval: true,
          walkInApprovalMinutes: 15,
        },
      },
    },
  });

  const block = await prisma.block.upsert({
    where: { condoId_name: { condoId: condo.id, name: 'A' } },
    update: {},
    create: { condoId: condo.id, name: 'A', position: 0 },
  });

  const unit = await prisma.unit.upsert({
    where: { condoId_identifier: { condoId: condo.id, identifier: 'A-01-1' } },
    update: {},
    create: {
      condoId: condo.id,
      blockId: block.id,
      identifier: 'A-01-1',
      floor: 1,
      sqft: 1000,
      bedrooms: 2,
      bathrooms: 2,
      status: 'OCCUPIED',
    },
  });

  const secondUnit = await prisma.unit.upsert({
    where: { condoId_identifier: { condoId: condo.id, identifier: 'A-01-2' } },
    update: {},
    create: {
      condoId: condo.id,
      blockId: block.id,
      identifier: 'A-01-2',
      floor: 1,
      sqft: 1100,
      bedrooms: 2,
      bathrooms: 2,
      status: 'OCCUPIED',
    },
  });

  const emails = {
    admin: 'integration-admin@test.local',
    owner: 'integration-owner@test.local',
    guard: 'integration-guard@test.local',
  };

  const admin = await prisma.user.upsert({
    where: { email: emails.admin },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: {
      email: emails.admin,
      name: 'Integration Admin',
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: emails.owner },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: {
      email: emails.owner,
      name: 'Integration Owner',
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const guard = await prisma.user.upsert({
    where: { email: emails.guard },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: {
      email: emails.guard,
      name: 'Integration Guard',
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.roleAssignment.deleteMany({
    where: { userId: { in: [admin.id, owner.id, guard.id] } },
  });

  await prisma.roleAssignment.createMany({
    data: [
      { userId: admin.id, roleId: RoleId.MANAGEMENT_ADMIN, condoId: condo.id },
      { userId: guard.id, roleId: RoleId.SECURITY_GUARD, condoId: condo.id },
      {
        userId: owner.id,
        roleId: RoleId.UNIT_OWNER,
        condoId: condo.id,
        unitId: unit.id,
      },
    ],
  });

  await prisma.ownership.upsert({
    where: {
      unitId_userId_startDate: {
        unitId: unit.id,
        userId: owner.id,
        startDate: new Date('2024-01-01T00:00:00Z'),
      },
    },
    update: { status: 'ACTIVE', isPrimary: true },
    create: {
      unitId: unit.id,
      userId: owner.id,
      sharePercent: 100,
      isPrimary: true,
      status: 'ACTIVE',
      startDate: new Date('2024-01-01T00:00:00Z'),
    },
  });

  const tokens = {
    admin: await signInToken(app, emails.admin),
    owner: await signInToken(app, emails.owner),
    guard: await signInToken(app, emails.guard),
  };

  return {
    condoId: condo.id,
    unitId: unit.id,
    secondUnitId: secondUnit.id,
    tokens,
    userIds: { admin: admin.id, owner: owner.id, guard: guard.id },
    emails,
  };
}

export async function signInToken(
  app: INestApplication,
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('X-Forwarded-For', signInTestIp(email))
    .send({ email, password })
    .expect(200);
  const token = res.body.data?.accessToken ?? res.body.accessToken;
  if (!token) throw new Error(`Sign-in did not return an access token for ${email}`);
  return token;
}
