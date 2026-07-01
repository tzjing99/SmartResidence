import { randomUUID } from 'node:crypto';
/**
 * SmartResidence demo seed.
 *
 * Creates "Acacia Heights" condo with 3 blocks, 120 units, and a small set of
 * users covering every role in the system. Idempotent — safe to re-run.
 *
 * Run with: pnpm db:seed
 */
import {
  AnnouncementImportance,
  DefectReportKind,
  DefectSeverity,
  DefectStatus,
  InvoiceStatus,
  LedgerEntryType,
  LedgerFund,
  PrismaClient,
  RoleId,
  RoleScope,
  ThreadCategory,
  ThreadMessageKind,
  ThreadPriority,
  ThreadStatus,
  UnitStatus,
  VisitorEntryMode,
  VisitorPurpose,
  VisitorStatus,
  VisitorVisitType,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo!2026';

async function main() {
  console.log('🏗  Seeding SmartResidence demo data…');

  await prisma.role.createMany({
    data: [
      {
        id: RoleId.SUPER_ADMIN,
        name: 'Platform admin',
        scope: RoleScope.PLATFORM,
        description: 'Operates the SmartResidence platform',
      },
      {
        id: RoleId.MANAGEMENT_ADMIN,
        name: 'Management admin',
        scope: RoleScope.CONDO,
        description: 'Full administrator for one condo',
      },
      {
        id: RoleId.MANAGEMENT_STAFF,
        name: 'Management staff',
        scope: RoleScope.CONDO,
        description: 'Scoped management permissions',
      },
      {
        id: RoleId.SECURITY_GUARD,
        name: 'Security guard',
        scope: RoleScope.CONDO,
        description: 'Visitor verification and check-in',
      },
      {
        id: RoleId.UNIT_OWNER,
        name: 'Unit owner',
        scope: RoleScope.UNIT,
        description: 'Owns a unit; full control over its data',
      },
      {
        id: RoleId.TENANT,
        name: 'Tenant',
        scope: RoleScope.UNIT,
        description: 'Rents a unit, granted by the owner',
      },
      {
        id: RoleId.HOUSEHOLD_MEMBER,
        name: 'Household member',
        scope: RoleScope.UNIT,
        description: 'Family member under owner/tenant',
      },
      {
        id: RoleId.CONTRACTOR,
        name: 'Contractor',
        scope: RoleScope.UNIT,
        description: 'External worker scoped to a defect ticket',
      },
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
    update: { phone: '+60123456789' },
    create: {
      email: 'owner@acacia.demo',
      phone: '+60123456789',
      name: 'Aisyah binti Rahman',
      passwordHash,
      emailVerifiedAt: new Date(),
      locale: 'en',
    },
  });

  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@acacia.demo' },
    update: { phone: '+60198765432' },
    create: {
      email: 'tenant@acacia.demo',
      phone: '+60198765432',
      name: 'Wong Wei Ming',
      passwordHash,
      emailVerifiedAt: new Date(),
      locale: 'en',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@acacia.demo' },
    update: { phone: '+60111222333' },
    create: {
      email: 'admin@acacia.demo',
      phone: '+60111222333',
      name: 'Daniel Lim (Manager)',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const guard = await prisma.user.upsert({
    where: { email: 'guard@acacia.demo' },
    update: { phone: '+60177665544' },
    create: {
      email: 'guard@acacia.demo',
      phone: '+60177665544',
      name: 'Encik Hassan (Guard)',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const platformAdmin = await prisma.user.upsert({
    where: { email: 'super@smartresidence.dev' },
    update: { phone: '+60199887766' },
    create: {
      email: 'super@smartresidence.dev',
      phone: '+60199887766',
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
    update: { status: 'ACTIVE', isPrimary: true },
    create: {
      unitId: ownerUnit.id,
      userId: owner.id,
      sharePercent: 100,
      isPrimary: true,
      status: 'ACTIVE',
      startDate: new Date('2024-01-01T00:00:00Z'),
    },
  });

  await prisma.tenancy
    .create({
      data: {
        unitId: ownerUnit.id,
        userId: tenant.id,
        startDate: new Date('2025-06-01T00:00:00Z'),
        endDate: new Date('2026-05-31T23:59:59Z'),
      },
    })
    .catch(() => {});

  await prisma.condo.update({
    where: { id: condo.id },
    data: {
      settings: {
        helpdesk: {
          resolutionConfirmationGraceDays: 7,
          autoAssignment: {
            generalTriagePool: [admin.id],
            seniorStaffPool: [admin.id],
            categoryPools: [
              { category: 'MAINTENANCE', userIds: [admin.id] },
              { category: 'BILLING', userIds: [admin.id] },
            ],
          },
        },
        visitor: {
          maxOvernightVisitsPerUnitPerMonth: 4,
          overnightSlotsPerNight: 10,
          walkInApprovalMinutes: 15,
          preRegExpiryBufferMins: 120,
          urgentOvernightMinHours: 24,
          workingDays: { weekdays: [1, 2, 3, 4, 5] },
          holidayAuto: true,
          holidayState: '10',
          customHolidays: ['2026-06-06'],
          holidayExclusions: [],
          countPendingTowardCap: true,
          requirePlatePhotoOvernight: true,
          defaultPurpose: 'VISITOR',
        },
      },
    },
  });

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
  const maintenanceFeePerSqft = formulaConfig.maintenanceFeePerSqft ?? 0.3;
  const sinkingFundPerSqft = formulaConfig.sinkingFundPerSqft ?? 0.05;
  const maintenanceFee = Number((maintenanceFeePerSqft * sqft).toFixed(2));
  const sinkingFund = Number((sinkingFundPerSqft * sqft).toFixed(2));
  const garbage = formulaConfig.garbagePerUnit ?? 15;
  const subtotal = maintenanceFee + sinkingFund + garbage;
  const total = subtotal;

  const invoiceNumber = `INV-${new Date().getFullYear()}-000001`;
  const invoice = await prisma.invoice.upsert({
    where: { condoId_number: { condoId: condo.id, number: invoiceNumber } },
    update: {},
    create: {
      condoId: condo.id,
      unitId: ownerUnit.id,
      number: invoiceNumber,
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
            formula: `${maintenanceFeePerSqft}/sqft × ${sqft} sqft`,
            quantity: 1,
            unitPrice: maintenanceFee,
            amount: maintenanceFee,
            sortOrder: 0,
          },
          {
            code: 'SINK',
            description: 'Sinking fund contribution',
            formula: `${sinkingFundPerSqft}/sqft × ${sqft} sqft`,
            quantity: 1,
            unitPrice: sinkingFund,
            amount: sinkingFund,
            sortOrder: 1,
          },
          {
            code: 'GARB',
            description: 'Garbage collection',
            formula: 'Flat fee per unit',
            quantity: 1,
            unitPrice: garbage,
            amount: garbage,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  // Record the matching accounting ledger CHARGE entries so fund balances and
  // the unit statement are consistent with the issued invoice (the app does
  // this automatically; the seed writes the invoice directly so we mirror it).
  const existingCharges = await prisma.ledgerEntry.count({
    where: { sourceType: 'Invoice', sourceId: invoice.id },
  });
  if (existingCharges === 0) {
    await prisma.ledgerEntry.createMany({
      data: [
        {
          condoId: condo.id,
          unitId: ownerUnit.id,
          fund: LedgerFund.MAINTENANCE,
          type: LedgerEntryType.CHARGE,
          amount: maintenanceFee,
          sourceType: 'Invoice',
          sourceId: invoice.id,
          memo: 'Monthly maintenance fee',
          occurredAt: invoice.issuedAt ?? new Date(),
        },
        {
          condoId: condo.id,
          unitId: ownerUnit.id,
          fund: LedgerFund.SINKING_FUND,
          type: LedgerEntryType.CHARGE,
          amount: sinkingFund,
          sourceType: 'Invoice',
          sourceId: invoice.id,
          memo: 'Sinking fund contribution',
          occurredAt: invoice.issuedAt ?? new Date(),
        },
        {
          condoId: condo.id,
          unitId: ownerUnit.id,
          fund: LedgerFund.GENERAL,
          type: LedgerEntryType.CHARGE,
          amount: garbage,
          sourceType: 'Invoice',
          sourceId: invoice.id,
          memo: 'Garbage collection',
          occurredAt: invoice.issuedAt ?? new Date(),
        },
      ],
    });
  }

  const preRegExpected = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const preRegVisitorId = randomUUID();
  const preRegCode = 'MEI9L2';
  const preRegPayload = `${condo.id}:${preRegVisitorId}:${preRegCode}`;
  await prisma.visitor.create({
    data: {
      id: preRegVisitorId,
      condoId: condo.id,
      visitType: VisitorVisitType.PRE_REG,
      unitId: ownerUnit.id,
      hostUserId: owner.id,
      name: 'Mei Lin (sister)',
      phone: '+60123456789',
      phoneCountryCode: '+60',
      entryMode: VisitorEntryMode.DRIVE_IN,
      vehiclePlate: 'WSC 1234',
      purpose: VisitorPurpose.VISITOR,
      expectedAt: preRegExpected,
      expectedDurationMins: 120,
      qrPayload: preRegPayload,
      qrCode: preRegPayload,
      accessCode: preRegCode,
      expiresAt: new Date(preRegExpected.getTime() + (120 + 120) * 60_000),
      status: VisitorStatus.APPROVED,
      approvedByUserId: owner.id,
      approvedAt: new Date(),
    },
  });

  await prisma.visitor.create({
    data: {
      condoId: condo.id,
      visitType: VisitorVisitType.WALKIN_UNIT,
      unitId: ownerUnit.id,
      name: 'Delivery rider (demo pending)',
      purpose: VisitorPurpose.DELIVERY,
      overnight: false,
      expectedAt: new Date(),
      status: VisitorStatus.PENDING_OWNER_APPROVAL,
      approvalDeadline: new Date(Date.now() + 15 * 60_000),
      metadata: { createdByGuardId: guard.id, demo: true },
    },
  });

  const pastVisitAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.visitor.create({
    data: {
      condoId: condo.id,
      visitType: VisitorVisitType.PRE_REG,
      unitId: ownerUnit.id,
      hostUserId: owner.id,
      name: 'Ah Beng (plumber)',
      purpose: VisitorPurpose.MAINTENANCE,
      expectedAt: pastVisitAt,
      status: VisitorStatus.CHECKED_OUT,
      approvedByUserId: owner.id,
      approvedAt: pastVisitAt,
      expiresAt: new Date(pastVisitAt.getTime() + 4 * 60 * 60 * 1000),
    },
  });

  await prisma.visitor.create({
    data: {
      condoId: condo.id,
      visitType: VisitorVisitType.WALKIN_UNIT,
      unitId: ownerUnit.id,
      name: 'Unknown courier (rejected)',
      purpose: VisitorPurpose.DELIVERY,
      overnight: false,
      expectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: VisitorStatus.REJECTED,
      metadata: { demo: true },
    },
  });

  const overnightPendingAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await prisma.visitor.create({
    data: {
      condoId: condo.id,
      visitType: VisitorVisitType.PRE_REG,
      unitId: ownerUnit.id,
      hostUserId: owner.id,
      name: 'Cousin Alex (overnight pending)',
      phone: '+60198765432',
      phoneCountryCode: '+60',
      entryMode: VisitorEntryMode.DRIVE_IN,
      vehiclePlate: 'WKL 3344',
      purpose: VisitorPurpose.VISITOR,
      overnight: true,
      urgentOvernight: false,
      expectedAt: overnightPendingAt,
      expectedDurationMins: 720,
      status: VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
    },
  });

  const urgentOvernightAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
  await prisma.visitor.create({
    data: {
      condoId: condo.id,
      visitType: VisitorVisitType.PRE_REG,
      unitId: ownerUnit.id,
      hostUserId: owner.id,
      name: 'Emergency guest (urgent overnight)',
      entryMode: VisitorEntryMode.DRIVE_IN,
      vehiclePlate: 'BJK 8899',
      purpose: VisitorPurpose.VISITOR,
      overnight: true,
      urgentOvernight: true,
      urgentReason: 'Family member flew in early — hospital visit',
      expectedAt: urgentOvernightAt,
      status: VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
    },
  });

  await prisma.favouriteVisitor.createMany({
    data: [
      {
        userId: owner.id,
        unitId: ownerUnit.id,
        name: 'Mei Lin (sister)',
        phone: '+60123456789',
        phoneCountryCode: '+60',
        entryMode: VisitorEntryMode.DRIVE_IN,
        vehiclePlate: 'WSC 1234',
        notes: 'Family — usually weekends',
      },
      {
        userId: owner.id,
        unitId: ownerUnit.id,
        name: 'Cleaner — Kak Siti',
        phone: '+60198765432',
        notes: 'Every Tuesday 10am',
      },
    ],
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

  // --- Demo defect packages (multi-defect submissions) ------------------
  const packageCount = await prisma.defectReport.count({ where: { condoId: condo.id } });
  if (packageCount === 0) {
    const now = Date.now();

    // Helper to find a unit by identifier within the condo
    const findUnit = (identifier: string) =>
      prisma.unit.findUniqueOrThrow({
        where: { condoId_identifier: { condoId: condo.id, identifier } },
      });

    // Package 1 — A-03-1, newly submitted, all defects still open
    const unitA031 = await findUnit('A-03-1');
    const pkg1 = await prisma.defectReport.create({
      data: {
        condoId: condo.id,
        unitId: unitA031.id,
        raisedByUserId: owner.id,
        kind: DefectReportKind.HANDOVER,
        title: 'Multiple defects',
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.defect.createMany({
      data: [
        {
          condoId: condo.id,
          unitId: unitA031.id,
          raisedByUserId: owner.id,
          reportId: pkg1.id,
          category: 'Plumbing',
          severity: DefectSeverity.HIGH,
          title: 'Master Bathroom - Shower: Leaking showerhead',
          description: 'Water drips continuously even when shower is off.',
          spaceLabel: 'Master Bathroom',
          location: 'Master Bathroom',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitA031.id,
          raisedByUserId: owner.id,
          reportId: pkg1.id,
          category: 'Electrical',
          severity: DefectSeverity.MEDIUM,
          title: 'Master Bathroom - Light switch: Not functioning',
          description: 'Light switch plate is loose and intermittently cuts power.',
          spaceLabel: 'Master Bathroom',
          location: 'Master Bathroom',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitA031.id,
          raisedByUserId: owner.id,
          reportId: pkg1.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Living Room - Wall: Hairline crack',
          description: 'Hairline crack along the top-right corner above the TV feature wall.',
          spaceLabel: 'Living Room',
          location: 'Living Room',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitA031.id,
          raisedByUserId: owner.id,
          reportId: pkg1.id,
          category: 'Plumbing',
          severity: DefectSeverity.MEDIUM,
          title: 'Kitchen - Sink: Drainage slow',
          description: 'Kitchen sink drains very slowly, possible blockage in pipe.',
          spaceLabel: 'Kitchen',
          location: 'Kitchen',
          status: DefectStatus.ACK,
          acknowledgedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitA031.id,
          raisedByUserId: owner.id,
          reportId: pkg1.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Bedroom 2 - Door: Does not close properly',
          description: 'Bedroom 2 door does not latch properly — hinges misaligned.',
          spaceLabel: 'Bedroom 2',
          location: 'Bedroom 2',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    // Package 2 — B-07-3, contractor assigned and in progress
    const unitB073 = await findUnit('B-07-3');
    const pkg2 = await prisma.defectReport.create({
      data: {
        condoId: condo.id,
        unitId: unitB073.id,
        raisedByUserId: tenant.id,
        kind: DefectReportKind.HANDOVER,
        title: 'Multiple defects',
        createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.defect.createMany({
      data: [
        {
          condoId: condo.id,
          unitId: unitB073.id,
          raisedByUserId: tenant.id,
          reportId: pkg2.id,
          category: 'Electrical',
          severity: DefectSeverity.URGENT,
          title: 'Utility Room - DB Box: Tripping breaker',
          description: 'Circuit breaker trips every evening around 7–8pm when AC and oven are on.',
          spaceLabel: 'Utility Room',
          location: 'Utility Room',
          status: DefectStatus.IN_PROGRESS,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitB073.id,
          raisedByUserId: tenant.id,
          reportId: pkg2.id,
          category: 'Plumbing',
          severity: DefectSeverity.HIGH,
          title: 'Second Bathroom - Floor: Water ponding',
          description:
            'Water accumulates at the floor drain area — floor screed not sloped properly.',
          spaceLabel: 'Second Bathroom',
          location: 'Second Bathroom',
          status: DefectStatus.ASSIGNED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitB073.id,
          raisedByUserId: tenant.id,
          reportId: pkg2.id,
          category: 'Structural',
          severity: DefectSeverity.MEDIUM,
          title: 'Bedroom 1 - Ceiling: Damp patch',
          description:
            'Visible damp stain on bedroom 1 ceiling near the AC unit, possibly condensation leak.',
          spaceLabel: 'Bedroom 1',
          location: 'Bedroom 1',
          status: DefectStatus.RESOLVED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitB073.id,
          raisedByUserId: tenant.id,
          reportId: pkg2.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Balcony - Wall: Paint peeling',
          description: 'Exterior-facing balcony wall paint peeling off in large sections.',
          spaceLabel: 'Balcony',
          location: 'Balcony',
          status: DefectStatus.RESOLVED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    // Package 3 — C-02-4, all defects fixed and closed (completed handover)
    const unitC024 = await findUnit('C-02-4');
    const pkg3 = await prisma.defectReport.create({
      data: {
        condoId: condo.id,
        unitId: unitC024.id,
        raisedByUserId: owner.id,
        kind: DefectReportKind.HANDOVER,
        title: 'Multiple defects',
        createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.defect.createMany({
      data: [
        {
          condoId: condo.id,
          unitId: unitC024.id,
          raisedByUserId: owner.id,
          reportId: pkg3.id,
          category: 'Plumbing',
          severity: DefectSeverity.MEDIUM,
          title: 'Kitchen - Tap: Dripping',
          description: 'Kitchen tap drips when closed fully.',
          spaceLabel: 'Kitchen',
          location: 'Kitchen',
          status: DefectStatus.CLOSED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 13 * 24 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
          closedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitC024.id,
          raisedByUserId: owner.id,
          reportId: pkg3.id,
          category: 'Electrical',
          severity: DefectSeverity.LOW,
          title: 'Living Room - Power socket: Loose fitting',
          description: 'Power socket near the TV console is loose — plug keeps falling out.',
          spaceLabel: 'Living Room',
          location: 'Living Room',
          status: DefectStatus.CLOSED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 13 * 24 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
          closedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000),
        },
        {
          condoId: condo.id,
          unitId: unitC024.id,
          raisedByUserId: owner.id,
          reportId: pkg3.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Master Bathroom - Tiles: Hollow tile',
          description: 'Three floor tiles near the shower drain sound hollow when tapped.',
          spaceLabel: 'Master Bathroom',
          location: 'Master Bathroom',
          status: DefectStatus.CLOSED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 13 * 24 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
          closedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

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

  // --- SLA policies -------------------------------------------------
  await prisma.slaPolicy.createMany({
    data: [
      {
        condoId: condo.id,
        priority: ThreadPriority.URGENT,
        firstResponseMins: 60,
        resolutionMins: 240,
      },
      {
        condoId: condo.id,
        priority: ThreadPriority.HIGH,
        firstResponseMins: 240,
        resolutionMins: 1440,
      },
      {
        condoId: condo.id,
        priority: ThreadPriority.NORMAL,
        firstResponseMins: 480,
        resolutionMins: 4320,
      },
      {
        condoId: condo.id,
        priority: ThreadPriority.LOW,
        firstResponseMins: 1440,
        resolutionMins: 10080,
      },
    ],
    skipDuplicates: true,
  });

  // --- FAQ ----------------------------------------------------------
  const faqCount = await prisma.faqArticle.count({ where: { condoId: condo.id } });
  if (faqCount === 0) {
    const billingCat = await prisma.faqCategory.create({
      data: { condoId: condo.id, name: 'Billing & Payments', position: 0 },
    });
    const facilityCat = await prisma.faqCategory.create({
      data: { condoId: condo.id, name: 'Facilities', position: 1 },
    });
    const generalCat = await prisma.faqCategory.create({
      data: { condoId: condo.id, name: 'General', position: 2 },
    });
    await prisma.faqArticle.createMany({
      data: [
        {
          condoId: condo.id,
          categoryId: billingCat.id,
          question: 'How is my monthly maintenance fee calculated?',
          answer:
            'Your fee is charged per square foot of your unit. Open any invoice to see the exact formula, e.g. "Maintenance 0.30/sqft × 1,100 sqft = 330.00", plus the sinking fund and a flat garbage charge.',
          tags: ['fees', 'maintenance', 'sinking fund'],
          published: true,
          pinned: true,
          authorUserId: admin.id,
        },
        {
          condoId: condo.id,
          categoryId: billingCat.id,
          question: 'What payment methods are accepted?',
          answer:
            'You can pay online by card or FPX directly from the Fees page. A receipt is issued automatically once payment succeeds.',
          tags: ['payment', 'fpx'],
          published: true,
          authorUserId: admin.id,
        },
        {
          condoId: condo.id,
          categoryId: facilityCat.id,
          question: 'What are the swimming pool opening hours?',
          answer:
            'The pool is open daily from 7:00am to 10:00pm. Children must be supervised at all times.',
          tags: ['pool', 'facilities'],
          published: true,
          authorUserId: admin.id,
        },
        {
          condoId: condo.id,
          categoryId: facilityCat.id,
          question: 'How do I register a visitor?',
          answer:
            'Go to Visitors → New visitor, fill in their details and expected time. A QR pass is generated that the guardhouse scans on arrival.',
          tags: ['visitor', 'security'],
          published: true,
          authorUserId: admin.id,
        },
        {
          condoId: condo.id,
          categoryId: generalCat.id,
          question: 'How do I report a defect or maintenance issue?',
          answer:
            'Use Defects → New defect. Add photos and a description; you can track its status from submission to resolution and chat with management on the ticket.',
          tags: ['defect', 'maintenance'],
          published: true,
          authorUserId: admin.id,
        },
        {
          condoId: condo.id,
          categoryId: generalCat.id,
          question: 'When is the next AGM?',
          answer:
            'The Annual General Meeting notice, agenda and proxy forms are posted under Announcements at least 14 days in advance, as required by the Strata Management Act 2013.',
          tags: ['agm', 'governance'],
          published: true,
          authorUserId: admin.id,
        },
      ],
    });
  }

  // --- Unit types, room templates & defect taxonomy -----------------
  const unitTypeCount = await prisma.unitType.count({ where: { condoId: condo.id } });
  if (unitTypeCount === 0) {
    // Per-space-type taxonomy of common elements and their typical issues.
    const taxonomy: Array<{ name: string; elements: Array<{ name: string; issues: string[] }> }> = [
      {
        name: 'Bathroom',
        elements: [
          {
            name: 'Tiles',
            issues: ['Cracked tiles', 'Uneven tiles', 'Hollow tiles', 'Stained grout'],
          },
          { name: 'Tap / Faucet', issues: ['Leaking', 'Loose', 'No water flow', 'Low pressure'] },
          { name: 'Toilet bowl', issues: ['Not flushing', 'Cracked', 'Loose seat', 'Water leak'] },
          { name: 'Door', issues: ['Does not close', 'Misaligned', 'Scratched', 'Faulty lock'] },
          { name: 'Waterproofing', issues: ['Damp patch', 'Water seepage', 'Mould'] },
        ],
      },
      {
        name: 'Kitchen',
        elements: [
          {
            name: 'Cabinets',
            issues: ['Door misaligned', 'Scratched', 'Loose hinge', 'Missing handle'],
          },
          { name: 'Sink', issues: ['Leaking', 'Clogged', 'Scratched', 'Loose tap'] },
          { name: 'Countertop', issues: ['Cracked', 'Stained', 'Uneven', 'Chipped edge'] },
          { name: 'Tiles', issues: ['Cracked tiles', 'Hollow tiles', 'Stained grout'] },
          { name: 'Power point', issues: ['Not working', 'Loose', 'No cover plate'] },
        ],
      },
      {
        name: 'Bedroom',
        elements: [
          { name: 'Wall', issues: ['Crack', 'Uneven paint', 'Stain', 'Dent'] },
          { name: 'Flooring', issues: ['Scratched', 'Uneven', 'Gap between planks', 'Squeaky'] },
          {
            name: 'Window',
            issues: ['Does not close', 'Scratched glass', 'Leaking', 'Faulty lock'],
          },
          {
            name: 'Wardrobe',
            issues: ['Door misaligned', 'Scratched', 'Loose handle', 'Broken rail'],
          },
          { name: 'Power point', issues: ['Not working', 'Loose', 'No cover plate'] },
        ],
      },
      {
        name: 'Living Room',
        elements: [
          { name: 'Wall', issues: ['Crack', 'Uneven paint', 'Stain', 'Dent'] },
          { name: 'Flooring', issues: ['Scratched', 'Uneven', 'Gap between planks', 'Squeaky'] },
          {
            name: 'Window',
            issues: ['Does not close', 'Scratched glass', 'Leaking', 'Faulty lock'],
          },
          { name: 'Ceiling', issues: ['Crack', 'Water stain', 'Uneven paint'] },
          { name: 'Power point', issues: ['Not working', 'Loose', 'No cover plate'] },
        ],
      },
      {
        name: 'Balcony',
        elements: [
          { name: 'Tiles', issues: ['Cracked tiles', 'Uneven tiles', 'Stained grout'] },
          { name: 'Railing', issues: ['Loose', 'Rusty', 'Wobbly', 'Scratched'] },
          { name: 'Drainage', issues: ['Clogged', 'Poor slope', 'Stagnant water'] },
          { name: 'Door', issues: ['Does not close', 'Scratched', 'Faulty lock'] },
        ],
      },
    ];

    const spaceTypeIdByName: Record<string, string> = {};
    for (let s = 0; s < taxonomy.length; s++) {
      const st = taxonomy[s]!;
      const created = await prisma.defectSpaceType.create({
        data: {
          condoId: condo.id,
          name: st.name,
          position: s,
          elements: {
            create: st.elements.map((el, ei) => ({
              condoId: condo.id,
              name: el.name,
              position: ei,
              issues: {
                create: el.issues.map((iss, ii) => ({
                  condoId: condo.id,
                  name: iss,
                  position: ii,
                })),
              },
            })),
          },
        },
      });
      spaceTypeIdByName[st.name] = created.id;
    }

    const unitTypeDefs: Array<{
      name: string;
      description: string;
      rooms: Array<{ name: string; spaceType: string }>;
    }> = [
      {
        name: 'Type A — 2 Bedroom',
        description: 'Standard 2-bedroom layout (~950–1,250 sqft).',
        rooms: [
          { name: 'Living Room', spaceType: 'Living Room' },
          { name: 'Kitchen', spaceType: 'Kitchen' },
          { name: 'Bedroom 1', spaceType: 'Bedroom' },
          { name: 'Bedroom 2', spaceType: 'Bedroom' },
          { name: 'Bathroom 1', spaceType: 'Bathroom' },
          { name: 'Bathroom 2', spaceType: 'Bathroom' },
          { name: 'Balcony', spaceType: 'Balcony' },
        ],
      },
      {
        name: 'Type B — 3 Bedroom',
        description: 'Larger 3-bedroom layout (~1,400–1,650 sqft).',
        rooms: [
          { name: 'Living Room', spaceType: 'Living Room' },
          { name: 'Kitchen', spaceType: 'Kitchen' },
          { name: 'Bedroom 1', spaceType: 'Bedroom' },
          { name: 'Bedroom 2', spaceType: 'Bedroom' },
          { name: 'Bedroom 3', spaceType: 'Bedroom' },
          { name: 'Bathroom 1', spaceType: 'Bathroom' },
          { name: 'Bathroom 2', spaceType: 'Bathroom' },
          { name: 'Balcony', spaceType: 'Balcony' },
        ],
      },
    ];

    const unitTypeIds: string[] = [];
    for (let t = 0; t < unitTypeDefs.length; t++) {
      const ut = unitTypeDefs[t]!;
      const created = await prisma.unitType.create({
        data: {
          condoId: condo.id,
          name: ut.name,
          description: ut.description,
          position: t,
          spaces: {
            create: ut.rooms.map((r, ri) => ({
              name: r.name,
              position: ri,
              spaceTypeId: spaceTypeIdByName[r.spaceType] ?? null,
            })),
          },
        },
      });
      unitTypeIds.push(created.id);
    }

    // Tag demo units so the handover flow works end-to-end: 3-bed units get
    // Type B, everyone else Type A.
    const [typeAId, typeBId] = unitTypeIds;
    if (typeBId) {
      await prisma.unit.updateMany({
        where: { condoId: condo.id, bedrooms: 3 },
        data: { unitTypeId: typeBId },
      });
    }
    if (typeAId) {
      await prisma.unit.updateMany({
        where: { condoId: condo.id, NOT: { bedrooms: 3 } },
        data: { unitTypeId: typeAId },
      });
    }

    // Per-unit-type monthly fee schedule (drives auto-generated invoices).
    for (const id of unitTypeIds) {
      await prisma.unitTypeFeeRate.upsert({
        where: { unitTypeId: id },
        update: {},
        create: {
          condoId: condo.id,
          unitTypeId: id,
          maintenanceRateType: 'PER_SQFT',
          maintenanceAmount: 0.3,
          sinkingFundRateType: 'PER_SQFT',
          sinkingFundAmount: 0.05,
        },
      });
    }
  }

  // --- Billing: receipt template + demo deposit ---------------------
  await prisma.condo.update({
    where: { id: condo.id },
    data: {
      settings: {
        ...((condo.settings as Record<string, unknown>) ?? {}),
        billing: {
          receipt: {
            numberPrefix: 'RCPT',
            organizationName: 'Acacia Heights JMB',
            registrationNo: 'JMB-WP-2021-0098',
            addressLines: '12 Jalan Acacia, Bukit Bintang\n55100 Kuala Lumpur',
            footerNote: 'This is a computer-generated receipt. Thank you.',
            signatoryName: 'Management Office',
            signatoryTitle: 'Authorised Signatory',
            logoUrl: '',
          },
        },
      },
    },
  });

  const depositCount = await prisma.deposit.count({ where: { condoId: condo.id } });
  if (depositCount === 0) {
    const deposit = await prisma.deposit.create({
      data: {
        condoId: condo.id,
        unitId: ownerUnit.id,
        userId: owner.id,
        type: 'RENOVATION',
        amount: 2000,
        currencyCode: 'MYR',
        status: 'HELD',
        method: 'BANK_TRANSFER',
        reference: 'TXN-RENO-0001',
        recordedByUserId: admin.id,
      },
    });
    await prisma.receipt.create({
      data: {
        condoId: condo.id,
        number: `RCPT-${new Date().getFullYear()}-000001`,
        kind: 'DEPOSIT',
        amount: 2000,
        currencyCode: 'MYR',
        issuedToUserId: owner.id,
        unitId: ownerUnit.id,
        depositId: deposit.id,
        description: 'Renovation deposit',
        templateSnapshot: {
          numberPrefix: 'RCPT',
          organizationName: 'Acacia Heights JMB',
        },
      },
    });
    // Mirror the deposit liability in the accounting ledger (the app records
    // this automatically when a deposit is taken).
    await prisma.ledgerEntry.create({
      data: {
        condoId: condo.id,
        unitId: ownerUnit.id,
        fund: LedgerFund.DEPOSIT,
        type: LedgerEntryType.DEPOSIT,
        amount: 2000,
        sourceType: 'Deposit',
        sourceId: deposit.id,
        memo: 'Renovation deposit',
        createdByUserId: admin.id,
      },
    });
  }

  // --- Demo communication threads -----------------------------------
  const threadCount = await prisma.thread.count({ where: { condoId: condo.id } });
  if (threadCount === 0) {
    const now = Date.now();
    const dueFrom = (start: number, mins: number) => new Date(start + mins * 60_000);

    // 1) URGENT, still OPEN (security)
    await prisma.thread.create({
      data: {
        condoId: condo.id,
        unitId: ownerUnit.id,
        createdByUserId: owner.id,
        subject: 'Suspicious person loitering at Block A lobby',
        category: ThreadCategory.SECURITY,
        priority: ThreadPriority.URGENT,
        status: ThreadStatus.OPEN,
        firstResponseDueAt: dueFrom(now, 60),
        resolutionDueAt: dueFrom(now, 240),
        lastMessageAt: new Date(),
        participants: { create: { userId: owner.id, lastReadAt: new Date() } },
        messages: {
          create: {
            authorUserId: owner.id,
            kind: ThreadMessageKind.MESSAGE,
            body: 'There is an unfamiliar person sitting in the Block A lobby for the past hour. Can security check?',
          },
        },
      },
    });

    // 2) NORMAL, awaiting management (billing)
    await prisma.thread.create({
      data: {
        condoId: condo.id,
        unitId: ownerUnit.id,
        createdByUserId: owner.id,
        subject: 'Question about the sinking fund contribution',
        category: ThreadCategory.BILLING,
        priority: ThreadPriority.NORMAL,
        status: ThreadStatus.AWAITING_MANAGEMENT,
        firstResponseDueAt: dueFrom(now, 480),
        resolutionDueAt: dueFrom(now, 4320),
        lastMessageAt: new Date(),
        participants: { create: { userId: owner.id, lastReadAt: new Date() } },
        messages: {
          create: {
            authorUserId: owner.id,
            kind: ThreadMessageKind.MESSAGE,
            body: 'Could you clarify how the sinking fund rate was decided for this year?',
          },
        },
      },
    });

    // 3) HIGH, resolved (maintenance) with a management reply
    const resolvedStart = now - 26 * 60 * 60 * 1000;
    await prisma.thread.create({
      data: {
        condoId: condo.id,
        unitId: ownerUnit.id,
        createdByUserId: owner.id,
        assignedToUserId: admin.id,
        subject: 'Corridor light flickering on level 5',
        category: ThreadCategory.MAINTENANCE,
        priority: ThreadPriority.HIGH,
        status: ThreadStatus.RESOLVED,
        firstResponseDueAt: dueFrom(resolvedStart, 240),
        resolutionDueAt: dueFrom(resolvedStart, 1440),
        firstRespondedAt: new Date(resolvedStart + 30 * 60_000),
        resolvedAt: new Date(now - 60 * 60 * 1000),
        createdAt: new Date(resolvedStart),
        lastMessageAt: new Date(now - 60 * 60 * 1000),
        participants: { create: { userId: owner.id, lastReadAt: new Date() } },
        messages: {
          create: [
            {
              authorUserId: owner.id,
              kind: ThreadMessageKind.MESSAGE,
              body: 'The corridor light outside A-05-2 keeps flickering — a bit unsafe at night.',
              createdAt: new Date(resolvedStart),
            },
            {
              authorUserId: admin.id,
              kind: ThreadMessageKind.MESSAGE,
              body: 'Thanks for reporting. We have logged it and our technician will replace the fitting today.',
              createdAt: new Date(resolvedStart + 30 * 60_000),
            },
            {
              authorUserId: admin.id,
              kind: ThreadMessageKind.SYSTEM,
              body: 'Status changed to RESOLVED',
              createdAt: new Date(now - 60 * 60 * 1000),
            },
          ],
        },
      },
    });

    // 4) NORMAL, pending resident confirmation (management proposed resolved)
    const proposedStart = now - 30 * 60 * 60 * 1000;
    await prisma.thread.create({
      data: {
        condoId: condo.id,
        unitId: ownerUnit.id,
        createdByUserId: owner.id,
        assignedToUserId: admin.id,
        subject: 'Gym treadmill making a grinding noise',
        category: ThreadCategory.FACILITY,
        priority: ThreadPriority.NORMAL,
        status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
        firstResponseDueAt: dueFrom(proposedStart, 480),
        resolutionDueAt: dueFrom(proposedStart, 4320),
        firstRespondedAt: new Date(proposedStart + 45 * 60_000),
        resolutionProposedAt: new Date(now - 2 * 60 * 60 * 1000),
        resolutionProposedByUserId: admin.id,
        createdAt: new Date(proposedStart),
        lastMessageAt: new Date(now - 2 * 60 * 60 * 1000),
        participants: { create: { userId: owner.id, lastReadAt: new Date() } },
        messages: {
          create: [
            {
              authorUserId: owner.id,
              kind: ThreadMessageKind.MESSAGE,
              body: 'Treadmill #2 in the gym makes a loud grinding noise when running.',
              createdAt: new Date(proposedStart),
            },
            {
              authorUserId: admin.id,
              kind: ThreadMessageKind.MESSAGE,
              body: 'Our vendor serviced the treadmill belt this morning — please confirm it is resolved.',
              createdAt: new Date(proposedStart + 45 * 60_000),
            },
            {
              authorUserId: admin.id,
              kind: ThreadMessageKind.SYSTEM,
              body: 'Management proposed this thread as resolved — awaiting resident confirmation.',
              createdAt: new Date(now - 2 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });
  }

  console.log('');
  console.log('✅ Seed complete.');
  console.log('');
  console.log(`Demo logins (password for all: ${DEMO_PASSWORD}):`);
  console.log('  Resident (owner)   →  owner@acacia.demo');
  console.log('  Resident (tenant)  →  tenant@acacia.demo');
  console.log('  Management admin   →  admin@acacia.demo');
  console.log('  Security guard     →  guard@acacia.demo');
  console.log('  Platform admin     →  super@smartresidence.dev');
  console.log('');
  console.log(`Demo invoice number: ${invoice.number}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
