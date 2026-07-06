import { z } from 'zod';
import type { SetupStatus } from './setup';

/** Lightweight row for the cross-condo platform console list. */
export interface PlatformCondoSummary {
  id: string;
  slug: string;
  name: string;
  address: string;
  countryCode: string;
  timezone: string;
  unitCount: number;
  userCount: number;
  enabledGatewayCount: number;
  setupCompleted: boolean;
  setupReady: boolean;
  openDefectCount: number;
  overdueInvoiceCount: number;
  lastActivityAt: string | null;
  createdAt: string;
}

export interface PlatformCondosPage {
  items: PlatformCondoSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** Drill-down payload for a single condo on the platform console. */
export interface PlatformCondoDetail {
  id: string;
  slug: string;
  name: string;
  address: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  locale: string;
  brandColor: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  unitCount: number;
  blockCount: number;
  residentCount: number;
  managementCount: number;
  enabledGatewayCount: number;
  lastActivityAt: string | null;
  setup: SetupStatus;
}

export interface PlatformAuditEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface PlatformBillingArrears {
  overdueInvoiceCount: number;
  overdueAmount: number;
  currencyCode: string;
}

/** Health dashboard payload for a single condo (platform detail page). */
export interface PlatformCondoHealth {
  condoId: string;
  userCount: number;
  unitCount: number;
  openDefectCount: number;
  billing: PlatformBillingArrears;
  recentAuditEvents: PlatformAuditEvent[];
  lastActivityAt: string | null;
  setupCompleted: boolean;
  setupReady: boolean;
}

export interface CreatePlatformCondoInput {
  name: string;
  slug: string;
  address: string;
  timezone: string;
}

export interface CreatePlatformCondoResult {
  id: string;
  slug: string;
  name: string;
  address: string;
  timezone: string;
  createdAt: string;
}

export const ListPlatformCondosQuery = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListPlatformCondosQuery = z.infer<typeof ListPlatformCondosQuery>;

export const CreatePlatformCondoBody = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  address: z.string().trim().min(5).max(500),
  timezone: z.string().trim().min(2).max(64),
});
export type CreatePlatformCondoBody = z.infer<typeof CreatePlatformCondoBody>;
