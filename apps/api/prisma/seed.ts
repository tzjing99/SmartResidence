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
  DefectSeverity,
  DefectStatus,
  InvoiceStatus,
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
          publicHolidays: ['2026-01-01', '2026-06-06', '2026-08-31', '2026-12-25'],
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
      phone: '123456789',
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
      phone: '198765432',
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
        phone: '123456789',
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
