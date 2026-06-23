import type { AuthenticatedUser } from '@/common/types/request-context';
import { AnnouncementAudienceScope, RoleId } from '@prisma/client';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

export type ResidentAudienceContext = {
  unitIds: string[];
  blockIds: string[];
};

export function isManagementForCondo(user: AuthenticatedUser, condoId: string): boolean {
  return user.roles.some(
    (r) => MANAGEMENT_ROLES.includes(r.roleId) && r.condoId === condoId,
  );
}

/** Resident unit + block ids within a condo (from role assignments). */
export function residentAudienceFromRoles(
  user: AuthenticatedUser,
  condoId: string,
  units: Array<{ id: string; blockId: string }>,
): ResidentAudienceContext {
  const roleUnitIds = new Set(
    user.roles
      .filter((r) => r.condoId === condoId && r.unitId)
      .map((r) => r.unitId as string),
  );
  const matched = units.filter((u) => roleUnitIds.has(u.id));
  return {
    unitIds: matched.map((u) => u.id),
    blockIds: [...new Set(matched.map((u) => u.blockId))],
  };
}

export function audienceWhereForResident(ctx: ResidentAudienceContext) {
  const { unitIds, blockIds } = ctx;
  return {
    OR: [
      { audienceScope: AnnouncementAudienceScope.CONDO },
      ...(blockIds.length
        ? [
            {
              audienceScope: AnnouncementAudienceScope.BLOCKS,
              blocks: { some: { blockId: { in: blockIds } } },
            },
          ]
        : []),
      ...(unitIds.length
        ? [
            {
              audienceScope: AnnouncementAudienceScope.UNITS,
              units: { some: { unitId: { in: unitIds } } },
            },
          ]
        : []),
    ],
  };
}

export function announcementMatchesResident(
  announcement: {
    audienceScope: AnnouncementAudienceScope;
    blocks: Array<{ blockId: string }>;
    units: Array<{ unitId: string }>;
  },
  ctx: ResidentAudienceContext,
): boolean {
  if (announcement.audienceScope === AnnouncementAudienceScope.CONDO) return true;
  if (announcement.audienceScope === AnnouncementAudienceScope.BLOCKS) {
    return announcement.blocks.some((b) => ctx.blockIds.includes(b.blockId));
  }
  if (announcement.audienceScope === AnnouncementAudienceScope.UNITS) {
    return announcement.units.some((u) => ctx.unitIds.includes(u.unitId));
  }
  return false;
}

export function formatAudienceSummary(input: {
  audienceScope: AnnouncementAudienceScope;
  blocks: Array<{ block: { name: string } }>;
  units: Array<{ unit: { identifier: string } }>;
}): string {
  switch (input.audienceScope) {
    case AnnouncementAudienceScope.CONDO:
      return 'Whole condo';
    case AnnouncementAudienceScope.BLOCKS: {
      const names = input.blocks.map((b) => b.block.name);
      if (names.length === 0) return 'Selected blocks';
      if (names.length <= 2) return `Block ${names.join(', ')}`;
      return `Block ${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    }
    case AnnouncementAudienceScope.UNITS: {
      const ids = input.units.map((u) => u.unit.identifier);
      if (ids.length === 0) return 'Selected units';
      if (ids.length === 1) return `Unit ${ids[0]}`;
      return `${ids.length} units`;
    }
    default:
      return 'Whole condo';
  }
}

type PrismaLike = {
  unit: {
    findMany: (args: {
      where: { condoId: string; blockId?: { in: string[] } };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
  };
  ownership: {
    findMany: (args: {
      where: { unitId: { in: string[] }; status: 'ACTIVE' };
      select: { userId: true };
    }) => Promise<Array<{ userId: string }>>;
  };
  tenancy: {
    findMany: (args: {
      where: { unitId: { in: string[] }; status: 'ACTIVE' };
      select: { userId: true };
    }) => Promise<Array<{ userId: string }>>;
  };
  roleAssignment: {
    findMany: (args: {
      where: { condoId: string; unitId: { in: string[] }; revokedAt: null };
      select: { userId: true };
    }) => Promise<Array<{ userId: string }>>;
  };
};

/** Residents (owners, tenants, unit-scoped roles) who should receive push for this notice. */
export async function resolveAnnouncementRecipientUserIds(
  prisma: PrismaLike,
  announcement: {
    audienceScope: AnnouncementAudienceScope;
    blocks: Array<{ blockId: string }>;
    units: Array<{ unitId: string }>;
  },
  condoId: string,
): Promise<string[]> {
  let unitIds: string[];

  switch (announcement.audienceScope) {
    case AnnouncementAudienceScope.CONDO: {
      const units = await prisma.unit.findMany({ where: { condoId }, select: { id: true } });
      unitIds = units.map((u) => u.id);
      break;
    }
    case AnnouncementAudienceScope.BLOCKS: {
      const blockIds = announcement.blocks.map((b) => b.blockId);
      if (blockIds.length === 0) return [];
      const units = await prisma.unit.findMany({
        where: { condoId, blockId: { in: blockIds } },
        select: { id: true },
      });
      unitIds = units.map((u) => u.id);
      break;
    }
    case AnnouncementAudienceScope.UNITS:
      unitIds = announcement.units.map((u) => u.unitId);
      break;
    default:
      unitIds = [];
  }

  if (unitIds.length === 0) return [];

  const [ownerships, tenancies, roles] = await Promise.all([
    prisma.ownership.findMany({
      where: { unitId: { in: unitIds }, status: 'ACTIVE' },
      select: { userId: true },
    }),
    prisma.tenancy.findMany({
      where: { unitId: { in: unitIds }, status: 'ACTIVE' },
      select: { userId: true },
    }),
    prisma.roleAssignment.findMany({
      where: { condoId, unitId: { in: unitIds }, revokedAt: null },
      select: { userId: true },
    }),
  ]);

  return [...new Set([...ownerships, ...tenancies, ...roles].map((r) => r.userId))];
}
