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
  enabledGatewayCount: number;
  setupCompleted: boolean;
  setupReady: boolean;
  lastActivityAt: string | null;
  createdAt: string;
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

export const ListPlatformCondosQuery = z.object({
  search: z.string().trim().max(120).optional(),
});
export type ListPlatformCondosQuery = z.infer<typeof ListPlatformCondosQuery>;
