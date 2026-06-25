/**
 * Seeds demo defect packages for A-03-1, B-07-3, and C-02-4.
 * Safe to run multiple times — skips units that already have a package.
 */
import { DefectReportKind, DefectSeverity, DefectStatus, PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const condo = await p.condo.findFirst();
  if (!condo) throw new Error('No condo found — run the main seed first.');

  const owner = await p.user.findUniqueOrThrow({ where: { email: 'owner@acacia.demo' } });
  const tenant = await p.user.findUniqueOrThrow({ where: { email: 'tenant@acacia.demo' } });
  const admin = await p.user.findUniqueOrThrow({ where: { email: 'admin@acacia.demo' } });

  const findUnit = (identifier: string) =>
    p.unit.findUniqueOrThrow({ where: { condoId_identifier: { condoId: condo.id, identifier } } });

  const now = Date.now();

  // --- Package 1: A-03-1 — freshly submitted, mix of open defects ---------
  const unitA = await findUnit('A-03-1');
  const existA = await p.defectReport.findFirst({ where: { unitId: unitA.id } });
  if (!existA) {
    const pkg = await p.defectReport.create({
      data: {
        condoId: condo.id,
        unitId: unitA.id,
        raisedByUserId: owner.id,
        kind: DefectReportKind.HANDOVER,
        title: 'Multiple defects',
        createdAt: new Date(now - 2 * 86400_000),
      },
    });
    await p.defect.createMany({
      data: [
        {
          condoId: condo.id,
          unitId: unitA.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Plumbing',
          severity: DefectSeverity.HIGH,
          title: 'Master Bathroom - Shower: Leaking showerhead',
          description: 'Water drips continuously even when shower is fully off.',
          spaceLabel: 'Master Bathroom',
          location: 'Master Bathroom',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitA.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Electrical',
          severity: DefectSeverity.MEDIUM,
          title: 'Master Bathroom - Light switch: Intermittent fault',
          description: 'Switch plate is loose and cuts power intermittently.',
          spaceLabel: 'Master Bathroom',
          location: 'Master Bathroom',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitA.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Living Room - Wall: Hairline crack',
          description: 'Hairline crack along top-right corner above the feature wall.',
          spaceLabel: 'Living Room',
          location: 'Living Room',
          status: DefectStatus.ACK,
          acknowledgedAt: new Date(now - 86400_000),
          createdAt: new Date(now - 2 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitA.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Plumbing',
          severity: DefectSeverity.MEDIUM,
          title: 'Kitchen - Sink: Slow drainage',
          description: 'Kitchen sink drains very slowly — possible partial blockage.',
          spaceLabel: 'Kitchen',
          location: 'Kitchen',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitA.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Bedroom 2 - Door: Misaligned latch',
          description: 'Door does not latch properly — hinges slightly misaligned.',
          spaceLabel: 'Bedroom 2',
          location: 'Bedroom 2',
          status: DefectStatus.NEW,
          createdAt: new Date(now - 2 * 86400_000),
        },
      ],
    });
    console.log('✅ Package 1 (A-03-1): 5 defects — new/submitted');
  } else {
    console.log('⏭  A-03-1 already has a package — skipped');
  }

  // --- Package 2: B-07-3 — contractor in progress, some resolved ----------
  const unitB = await findUnit('B-07-3');
  const existB = await p.defectReport.findFirst({ where: { unitId: unitB.id } });
  if (!existB) {
    const pkg = await p.defectReport.create({
      data: {
        condoId: condo.id,
        unitId: unitB.id,
        raisedByUserId: tenant.id,
        kind: DefectReportKind.HANDOVER,
        title: 'Multiple defects',
        createdAt: new Date(now - 5 * 86400_000),
      },
    });
    await p.defect.createMany({
      data: [
        {
          condoId: condo.id,
          unitId: unitB.id,
          raisedByUserId: tenant.id,
          reportId: pkg.id,
          category: 'Electrical',
          severity: DefectSeverity.URGENT,
          title: 'Utility Room - DB Box: Tripping breaker',
          description: 'Circuit breaker trips every evening when AC and oven run together.',
          spaceLabel: 'Utility Room',
          location: 'Utility Room',
          status: DefectStatus.IN_PROGRESS,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 86400_000),
          createdAt: new Date(now - 5 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitB.id,
          raisedByUserId: tenant.id,
          reportId: pkg.id,
          category: 'Plumbing',
          severity: DefectSeverity.HIGH,
          title: 'Second Bathroom - Floor: Water ponding',
          description: 'Water accumulates at drain — floor not properly sloped.',
          spaceLabel: 'Second Bathroom',
          location: 'Second Bathroom',
          status: DefectStatus.ASSIGNED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 86400_000),
          createdAt: new Date(now - 5 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitB.id,
          raisedByUserId: tenant.id,
          reportId: pkg.id,
          category: 'Structural',
          severity: DefectSeverity.MEDIUM,
          title: 'Bedroom 1 - Ceiling: Damp patch',
          description: 'Damp stain near AC unit — likely condensation leak.',
          spaceLabel: 'Bedroom 1',
          location: 'Bedroom 1',
          status: DefectStatus.RESOLVED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 86400_000),
          resolvedAt: new Date(now - 86400_000),
          createdAt: new Date(now - 5 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitB.id,
          raisedByUserId: tenant.id,
          reportId: pkg.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Balcony - Wall: Paint peeling',
          description: 'Exterior balcony wall paint peeling in large sections.',
          spaceLabel: 'Balcony',
          location: 'Balcony',
          status: DefectStatus.RESOLVED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 4 * 86400_000),
          resolvedAt: new Date(now - 86400_000),
          createdAt: new Date(now - 5 * 86400_000),
        },
      ],
    });
    console.log('✅ Package 2 (B-07-3): 4 defects — 2 active, 2 waiting sign-off');
  } else {
    console.log('⏭  B-07-3 already has a package — skipped');
  }

  // --- Package 3: C-02-4 — fully closed, completed handover ---------------
  const unitC = await findUnit('C-02-4');
  const existC = await p.defectReport.findFirst({ where: { unitId: unitC.id } });
  if (!existC) {
    const pkg = await p.defectReport.create({
      data: {
        condoId: condo.id,
        unitId: unitC.id,
        raisedByUserId: owner.id,
        kind: DefectReportKind.HANDOVER,
        title: 'Multiple defects',
        createdAt: new Date(now - 14 * 86400_000),
      },
    });
    await p.defect.createMany({
      data: [
        {
          condoId: condo.id,
          unitId: unitC.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Plumbing',
          severity: DefectSeverity.MEDIUM,
          title: 'Kitchen - Tap: Dripping',
          description: 'Kitchen tap drips when closed fully.',
          spaceLabel: 'Kitchen',
          location: 'Kitchen',
          status: DefectStatus.CLOSED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 13 * 86400_000),
          resolvedAt: new Date(now - 7 * 86400_000),
          closedAt: new Date(now - 5 * 86400_000),
          createdAt: new Date(now - 14 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitC.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Electrical',
          severity: DefectSeverity.LOW,
          title: 'Living Room - Power socket: Loose fitting',
          description: 'Plug keeps falling out from socket near the TV console.',
          spaceLabel: 'Living Room',
          location: 'Living Room',
          status: DefectStatus.CLOSED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 13 * 86400_000),
          resolvedAt: new Date(now - 7 * 86400_000),
          closedAt: new Date(now - 5 * 86400_000),
          createdAt: new Date(now - 14 * 86400_000),
        },
        {
          condoId: condo.id,
          unitId: unitC.id,
          raisedByUserId: owner.id,
          reportId: pkg.id,
          category: 'Structural',
          severity: DefectSeverity.LOW,
          title: 'Master Bathroom - Tiles: Hollow tile',
          description: 'Three tiles near the shower drain sound hollow when tapped.',
          spaceLabel: 'Master Bathroom',
          location: 'Master Bathroom',
          status: DefectStatus.CLOSED,
          assignedToUserId: admin.id,
          acknowledgedAt: new Date(now - 13 * 86400_000),
          resolvedAt: new Date(now - 7 * 86400_000),
          closedAt: new Date(now - 5 * 86400_000),
          createdAt: new Date(now - 14 * 86400_000),
        },
      ],
    });
    console.log('✅ Package 3 (C-02-4): 3 defects — all closed/signed off');
  } else {
    console.log('⏭  C-02-4 already has a package — skipped');
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
