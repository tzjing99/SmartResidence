import { ThreadPriority } from '@prisma/client';

/** Product-default resolution windows (minutes) for Malaysian condos. */
export const RECOMMENDED_RESOLUTION_MINS: Record<ThreadPriority, number> = {
  URGENT: 4 * 60,
  HIGH: 24 * 60,
  NORMAL: 3 * 24 * 60,
  LOW: 7 * 24 * 60,
};

export type SlaBand = 'recommended' | 'acceptable' | 'risky';

export interface SlaBandThresholds {
  recommendedMaxMins: number;
  acceptableMaxMins: number;
}

/**
 * Dynamic advisory bands (A1): larger condos get a wider acceptable window
 * before a setting is flagged risky — more units imply higher ticket volume.
 */
export function acceptableMultiplier(unitCount: number): number {
  const baseline = 50;
  const factor = Math.max(0.8, Math.min(2, Math.sqrt(Math.max(unitCount, 1) / baseline)));
  return 1 + 0.5 * (factor - 1);
}

export function bandThresholds(
  priority: ThreadPriority,
  unitCount: number,
): SlaBandThresholds {
  const recommendedMaxMins = RECOMMENDED_RESOLUTION_MINS[priority];
  const acceptableMaxMins = Math.round(recommendedMaxMins * acceptableMultiplier(unitCount));
  return { recommendedMaxMins, acceptableMaxMins };
}

export function classifyResolutionMins(
  priority: ThreadPriority,
  resolutionMins: number,
  unitCount: number,
): SlaBand {
  const { acceptableMaxMins } = bandThresholds(priority, unitCount);
  const recommendedMax = RECOMMENDED_RESOLUTION_MINS[priority];
  if (resolutionMins <= recommendedMax) return 'recommended';
  if (resolutionMins <= acceptableMaxMins) return 'acceptable';
  return 'risky';
}

export function deriveFirstResponseMins(resolutionMins: number): number {
  return Math.max(15, Math.round(resolutionMins * 0.4));
}
