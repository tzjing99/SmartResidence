/**
 * SmartResidence demo seed.
 *
 * Creates "Acacia Heights" condo with 3 blocks, 120 units, and a small set of
 * users covering every role in the system. Idempotent — safe to re-run.
 *
 * Run with: pnpm db:seed
 */
import {
  PrismaClient,
  RoleId,
  RoleScope,
  UnitStatus,
  AnnouncementImportance,
  DefectSeverity,
  DefectStatus,
  InvoiceStatus,
  VisitorStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo!2026';

async function main() {
  console.log('🏗  Seeding SmartResidence demo data…');

  await prisma.role.createMany({
    data: [
      { id: RoleId.SUPER_ADMIN, name: 'Platform admin', scope: RoleScope.PLATFORM, description: 'Operates the SmartResidence platform' },
      { id: RoleId.MANAGEMENT_ADMIN, name: 'Management admin', scope: RoleScope.CONDO, description: 'Full administrator for one condo' },
      { id: RoleId.MANAGEMENT_STAFF, name: 'Management staff', scope: RoleScope.CONDO, description: 'Scoped management permissions' },
      { id: RoleId.SECURITY_GUARD, name: 'Security guard', scope: RoleScope.CONDO, description: 'Visitor verification and check-in' },
      { id: RoleId.UNIT_OWNER, name: 'Unit owner', scope: RoleScope.UNIT, description: 'Owns a unit; full control over its data' },
      { id: RoleId.TENANT, name: 'Tenant', scope: RoleScope.UNIT, description: 'Rents a unit, granted by the owner' },
      { id: RoleId.HOUSEHOLD_MEMBER, name: 'Household member', scope: RoleScope.UNIT, description: 'Family member under owner/tenant' },
      { id: RoleId.CONTRACTOR, name: 'Contractor', scope: RoleScope.UNIT, description: 'External worker scoped to a defect ticket' },
    ],
    skipDuplicates: true,
  });

  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const condo = await prisma.condo.upsert({
    where: { slug: 'acacia-heights' },
    update: {},
    create: {
      slug: 'acacia-heights',
      name: 'Acacia Heights',
      address: '12 Jalan Acacia, Bukit Bintang, 55100 Kuala Lumpur',
      countryCode: 'MY',
      currencyCode: 'MYR',
      timezone: 'Asia/Kuala_Lumpur',
      locale: 'en',
      brandColor: '#FF5A5F',
      feeFormulaConfig: {
        sinkingFundPerSqft: 0.05,
        maintenanceFeePerSqft: 0.3,
        garbagePerUnit: 15,
      },
    },
  });

  const blocks = ['A', 'B', 'C'];
  const blockRecords: Record<string, { id: string }> = {};
  for (let i = 0; i < blocks.length; i++) {
    const name = blocks[i] as string;
    const block = await prisma.block.upsert({
      where: { condoId_name: { condoId: condo.id, name } },
      update: {},
      create: { condoId: condo.id, name, position: i },
    });
    blockRecords[name] = block;
  }

  const sqftSizes = [950, 1100, 1250, 1400, 1650];
  for (const blockName of blocks) {
    const block = blockRecords[blockName]!;
    for (let floor = 1; floor <= 10; floor++) {
      for (let unitNum = 1; unitNum <= 4; unitNum++) {
        const identifier = `${blockName}-${floor.toString().padStart(2, '0')}-${unitNum}`;
        const sqft = sqftSizes[(floor + unitNum) % sqftSizes.length] as number;
        await prisma.unit.upsert({
          where: { condoId_identifier: { condoId: condo.id, identifier } },
          update: {},
          create: {
            condoId: condo.id,
            blockId: block.id,
            identifier,
            floor,
            sqft,
            bedrooms: sqft >= 1300 ? 3 : 2,
            bathrooms: 2,
            status: UnitStatus.OCCUPIED,
          },
        });
      }
    }
  }

  const owner = await prisma.user.upsert({
    where: { email: 'owner@acacia.demo' },
    update: {},
    create: {
      email: 'owner@acacia.demo',
      name: 'Aisyah binti Rahman',
      passwordHash,
      emailVerifiedAt: new Date(),
      locale: 'en',
    },
  });

  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@acacia.demo' },
    update: {},
    create: {
      email: 'tenant@acacia.demo',
      name: 'Wong Wei Ming',
      passwordHash,
      emailVerifiedAt: new Date(),
      locale: 'en',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@acacia.demo' },
    update: {},
    create: {
      email: 'admin@acacia.demo',
      name: 'Daniel Lim (Manager)',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const guard = await prisma.user.upsert({
    where: { email: 'guard@acacia.demo' },
    update: {},
    create: {
      email: 'guard@acacia.demo',
      name: 'Encik Hassan (Guard)',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const platformAdmin = await prisma.user.upsert({
    where: { email: 'super@smartresidence.dev' },
    update: {},
    create: {
      email: 'super@smartresidence.dev',
      name: 'Platform Admin',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const ownerUnit = await prisma.unit.findUnique({
    where: { condoId_identifier: { condoId: condo.id, identifier: 'A-05-2' } },
  });
  if (!ownerUnit) throw new Error('Seed unit not found');

  await prisma.ownership.upsert({
    where: {
      unitId_userId_startDate: {
        unitId: ownerUnit.id,
        userId: owner.id,
        startDate: new Date('2024-01-01T00:00:00Z'),
      },
    },
    update: {},
    create: {
      unitId: ownerUnit.id,
      userId: owner.id,
      sharePercent: 100,
      isPrimary: true,
      startDate: new Date('2024-01-01T00:00:00Z'),
    },
  });

  await prisma.tenancy.create({
    data: {
      unitId: ownerUnit.id,
      userId: tenant.id,
      startDate: new Date('2025-06-01T00:00:00Z'),
      endDate: new Date('2026-05-31T23:59:59Z'),
    },
  }).catch(() => {});

  await prisma.roleAssignment.createMany({
    data: [
      {
        roleId: RoleId.SUPER_ADMIN,
        userId: platformAdmin.id,
        condoId: null,
      },
      {
        roleId: RoleId.MANAGEMENT_ADMIN,
        userId: admin.id,
        condoId: condo.id,
      },
      {
        roleId: RoleId.SECURITY_GUARD,
        userId: guard.id,
        condoId: condo.id,
      },
      {
        roleId: RoleId.UNIT_OWNER,
        userId: owner.id,
        condoId: condo.id,
        unitId: ownerUnit.id,
      },
      {
        roleId: RoleId.TENANT,
        userId: tenant.id,
        condoId: condo.id,
        unitId: ownerUnit.id,
      },
    ],
    skipDuplicates: true,
  });

  const sqft = Number(ownerUnit.sqft ?? 1100);
  const formulaConfig = condo.feeFormulaConfig as Record<string, number>;
  const maintenanceFee = Number((formulaConfig.maintenanceFeePerSqft * sqft).toFixed(2));
  const sinkingFund = Number((formulaConfig.sinkingFundPerSqft * sqft).toFixed(2));
  const garbage = formulaConfig.garbagePerUnit;
  const subtotal = maintenanceFee + sinkingFund + garbage;
  const total = subtotal;

  const invoice = await prisma.invoice.create({
    data: {
      condoId: condo.id,
      unitId: ownerUnit.id,
      number: `INV-${new Date().getFullYear()}-000001`,
      periodStart: new Date('2026-06-01T00:00:00Z'),
      periodEnd: new Date('2026-06-30T23:59:59Z'),
      dueDate: new Date('2026-06-15T23:59:59Z'),
      status: InvoiceStatus.ISSUED,
      subtotal,
      total,
      currencyCode: 'MYR',
      issuedAt: new Date(),
      lines: {
        create: [
          {
            code: 'MAINT',
            description: 'Monthly maintenance fee',
            formula: `${formulaConfig.maintenanceFeePerSqft}/sqft × ${sqft} sqft`,
            quantity: 1,
            unitPrice: maintenanceFee,
            amount: maintenanceFee,
            sortOrder: 0,
          },
          {
            code: 'SINK',
            description: 'Sinking fund contribution',
            formula: `${formulaConfig.sinkingFundPerSqft}/sqft × ${sqft} sqft`,
            quantity: 1,
            unitPrice: sinkingFund,
            amount: sinkingFund,
            sortOrder: 1,
          },
          {
            code: 'GARB',
            description: 'Garbage collection',
            formula: `Flat fee per unit`,
            quantity: 1,
            unitPrice: garbage,
            amount: garbage,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.visitor.create({
    data: {
      condoId: condo.id,
      unitId: ownerUnit.id,
      hostUserId: owner.id,
      name: 'Mei Lin (sister)',
      phone: '+60123456789',
      vehiclePlate: 'WSC 1234',
      purpose: 'Family visit',
      expectedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      expectedDurationMins: 120,
      qrCode: randomUUID(),
      status: VisitorStatus.APPROVED,
      approvedByUserId: owner.id,
      approvedAt: new Date(),
    },
  });

  await prisma.defect.create({
    data: {
      condoId: condo.id,
      unitId: ownerUnit.id,
      raisedByUserId: owner.id,
      category: 'Plumbing',
      severity: DefectSeverity.MEDIUM,
      title: 'Master bathroom sink leaking',
      description: 'Slow drip from the cold tap when not in use. Started yesterday.',
      location: 'Master bathroom',
      status: DefectStatus.NEW,
    },
  });

  await prisma.announcement.create({
    data: {
      condoId: condo.id,
      authorUserId: admin.id,
      title: 'Scheduled water supply interruption',
      body: '## Notice from JMB\n\nThe water utility will be performing pipe maintenance on **June 12, 2026** from **10am to 2pm**. Please store water in advance.',
      importance: AnnouncementImportance.IMPORTANT,
      publishedAt: new Date(),
      pinned: true,
      audience: { all: true },
    },
  });

  console.log('');
  console.log('✅ Seed complete.');
  console.log('');
  console.log('Demo logins (password for all: ' + DEMO_PASSWORD + '):');
  console.log('  Resident (owner)   →  owner@acacia.demo');
  console.log('  Resident (tenant)  →  tenant@acacia.demo');
  console.log('  Management admin   →  admin@acacia.demo');
  console.log('  Security guard     →  guard@acacia.demo');
  console.log('  Platform admin     →  super@smartresidence.dev');
  console.log('');
  console.log('Demo invoice number: ' + invoice.number);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
