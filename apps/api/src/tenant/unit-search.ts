import type { Prisma } from '@prisma/client';
import {
  normalizeUnitSearchTerm,
  parseCompositeUnitLabel,
} from '@smartresidence/shared-types';

export { normalizeUnitSearchTerm, parseCompositeUnitLabel };

/**
 * Build Prisma `where` clauses for unit search.
 * Matches identifier, block name, resident name, and composite labels like "A-01-1"
 * when block and identifier are stored separately (block "A", identifier "01-1").
 */
export function buildUnitSearchOrConditions(term: string): Prisma.UnitWhereInput[] {
  const normalized = normalizeUnitSearchTerm(term);
  const conditions: Prisma.UnitWhereInput[] = [
    { identifier: { contains: normalized, mode: 'insensitive' } },
    { block: { name: { contains: normalized, mode: 'insensitive' } } },
    {
      ownerships: {
        some: {
          status: 'ACTIVE',
          user: { name: { contains: normalized, mode: 'insensitive' } },
        },
      },
    },
  ];

  const composite = parseCompositeUnitLabel(normalized);
  if (composite) {
    conditions.push({
      AND: [
        {
          block: {
            name: { equals: composite.block, mode: 'insensitive' },
          },
        },
        {
          OR: [
            { identifier: { equals: composite.rest, mode: 'insensitive' } },
            { identifier: { contains: composite.rest, mode: 'insensitive' } },
          ],
        },
      ],
    });
  }

  return conditions;
}

export function buildUnitListWhere(
  condoId: string,
  search?: string,
): Prisma.UnitWhereInput {
  const term = search?.trim();
  if (!term) return { condoId };
  const normalized = normalizeUnitSearchTerm(term);
  return {
    condoId,
    OR: buildUnitSearchOrConditions(normalized),
  };
}
