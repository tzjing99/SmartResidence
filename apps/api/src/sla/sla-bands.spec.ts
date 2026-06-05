import { ThreadPriority } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  RECOMMENDED_RESOLUTION_MINS,
  bandThresholds,
  classifyResolutionMins,
  deriveFirstResponseMins,
} from './sla-bands';

describe('sla-bands', () => {
  it('derives first-response at 40% of resolution', () => {
    expect(deriveFirstResponseMins(240)).toBe(96);
    expect(deriveFirstResponseMins(100)).toBe(40);
  });

  it('classifies recommended band at product defaults', () => {
    for (const priority of Object.values(ThreadPriority)) {
      expect(
        classifyResolutionMins(priority, RECOMMENDED_RESOLUTION_MINS[priority], 50),
      ).toBe('recommended');
    }
  });

  it('widens acceptable band for larger condos (A1)', () => {
    const small = bandThresholds(ThreadPriority.NORMAL, 25);
    const large = bandThresholds(ThreadPriority.NORMAL, 200);
    expect(large.acceptableMaxMins).toBeGreaterThan(small.acceptableMaxMins);
  });

  it('flags risky when resolution exceeds acceptable max', () => {
    const { acceptableMaxMins } = bandThresholds(ThreadPriority.HIGH, 50);
    expect(classifyResolutionMins(ThreadPriority.HIGH, acceptableMaxMins + 1, 50)).toBe('risky');
  });
});
