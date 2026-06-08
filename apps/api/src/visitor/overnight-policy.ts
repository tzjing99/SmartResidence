import type { PrismaService } from '@/prisma/prisma.service';
import { OwnershipStatus, VisitorStatus } from '@prisma/client';
import type { CondoVisitorSettings } from './visitor-settings';

export { DEFAULT_MAX_OVERNIGHT_PER_OWNER_PER_MONTH } from './visitor-settings';

const COUNTED_WITH_PENDING: VisitorStatus[] = [
  VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
  VisitorStatus.APPROVED,
  VisitorStatus.CHECKED_IN,
  VisitorStatus.CHECKED_OUT,
];

const COUNTED_WITHOUT_PENDING: VisitorStatus[] = [
  VisitorStatus.APPROVED,
  VisitorStatus.CHECKED_IN,
  VisitorStatus.CHECKED_OUT,
];

export function countedOvernightStatuses(settings: CondoVisitorSettings): VisitorStatus[] {
  return settings.countPendingTowardCap ? COUNTED_WITH_PENDING : COUNTED_WITHOUT_PENDING;
}

export function calendarMonthRange(ref = new Date()): { start: Date; end: Date; key: string } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return { start, end, key };
}

export function parseMonthParam(month?: string): { start: Date; end: Date; key: string } {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return calendarMonthRange();
  const [yRaw, mRaw] = month.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return calendarMonthRange();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end, key: month };
}

/** Indefinite suspend uses a far-future sentinel date. */
export const INDEFINITE_SUSPEND_UNTIL = new Date('2099-12-31T23:59:59.000Z');

export function isIndefiniteSuspend(until: Date | null | undefined): boolean {
  return Boolean(until && until.getTime() >= INDEFINITE_SUSPEND_UNTIL.getTime());
}

export function isOvernightSuspended(
  policy: { overnightSuspendedUntil: Date | null } | null | undefined,
  now = new Date(),
): boolean {
  return Boolean(policy?.overnightSuspendedUntil && policy.overnightSuspendedUntil > now);
}

export async function countMonthlyOvernightForUnit(
  prisma: PrismaService,
  unitId: string,
  range: { start: Date; end: Date },
  settings: CondoVisitorSettings,
): Promise<number> {
  return prisma.visitor.count({
    where: {
      unitId,
      overnight: true,
      status: { in: countedOvernightStatuses(settings) },
      createdAt: { gte: range.start, lt: range.end },
    },
  });
}

export async function getPrimaryUnitOwner(
  prisma: PrismaService,
  unitId: string,
): Promise<{ userId: string; name: string } | null> {
  const ownership = await prisma.ownership.findFirst({
    where: { unitId, status: OwnershipStatus.ACTIVE, isPrimary: true },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startDate: 'asc' },
  });
  if (ownership) return { userId: ownership.userId, name: ownership.user.name };
  const fallback = await prisma.ownership.findFirst({
    where: { unitId, status: OwnershipStatus.ACTIVE },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startDate: 'asc' },
  });
  return fallback ? { userId: fallback.userId, name: fallback.user.name } : null;
}

export type UnitOwnerContact = {
  id: string;
  name: string;
  phone: string | null;
  isPrimary: boolean;
};

/** Active unit owners with phone — primary first, for guard walk-in fallback. */
export async function getUnitOwnerContacts(
  prisma: PrismaService,
  unitId: string,
): Promise<UnitOwnerContact[]> {
  const ownerships = await prisma.ownership.findMany({
    where: { unitId, status: OwnershipStatus.ACTIVE },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'asc' }],
  });
  return ownerships.map((o) => ({
    id: o.user.id,
    name: o.user.name,
    phone: o.user.phone,
    isPrimary: o.isPrimary,
  }));
}

export async function getUnitSuspendPolicy(
  prisma: PrismaService,
  unitId: string,
  now = new Date(),
) {
  const policies = await prisma.unitVisitorPolicy.findMany({ where: { unitId } });
  return policies.find((p) => isOvernightSuspended(p, now)) ?? null;
}

export type OvernightEligibility = {
  allowed: boolean;
  reason?: string;
  monthlyCount: number;
  monthlyLimit: number;
  suspended: boolean;
};

export async function checkUnitOvernightEligibility(
  prisma: PrismaService,
  unitId: string,
  _condoId: string,
  settings: CondoVisitorSettings,
  now = new Date(),
): Promise<OvernightEligibility> {
  const policy = await getUnitSuspendPolicy(prisma, unitId, now);
  const suspended = isOvernightSuspended(policy, now);
  if (suspended) {
    const untilLabel = isIndefiniteSuspend(policy?.overnightSuspendedUntil)
      ? 'until lifted by management'
      : policy?.overnightSuspendedUntil?.toLocaleDateString('en-MY');
    return {
      allowed: false,
      reason: policy?.suspendReason
        ? `Overnight registration suspended${untilLabel ? ` ${untilLabel}` : ''}: ${policy.suspendReason}`
        : 'Overnight registration is temporarily suspended for this unit — contact management',
      monthlyCount: 0,
      monthlyLimit: settings.maxOvernightVisitsPerUnitPerMonth,
      suspended: true,
    };
  }

  const range = calendarMonthRange(now);
  const monthlyCount = await countMonthlyOvernightForUnit(prisma, unitId, range, settings);
  const limit = settings.maxOvernightVisitsPerUnitPerMonth;
  if (monthlyCount >= limit) {
    return {
      allowed: false,
      reason: `Monthly overnight limit reached (${limit} per unit) — contact management`,
      monthlyCount,
      monthlyLimit: limit,
      suspended: false,
    };
  }

  return { allowed: true, monthlyCount, monthlyLimit: limit, suspended: false };
}
