import { DefectStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { VALID_TRANSITIONS, canTransitionDefect } from './defect-transitions';

describe('defect transitions', () => {
  it('allows the standard lifecycle path', () => {
    expect(canTransitionDefect(DefectStatus.NEW, DefectStatus.ACK)).toBe(true);
    expect(canTransitionDefect(DefectStatus.ACK, DefectStatus.IN_PROGRESS)).toBe(true);
    expect(canTransitionDefect(DefectStatus.IN_PROGRESS, DefectStatus.RESOLVED)).toBe(true);
    expect(canTransitionDefect(DefectStatus.RESOLVED, DefectStatus.CLOSED)).toBe(true);
  });

  it('allows admin to mark a submitted defect fixed for resident sign-off', () => {
    expect(canTransitionDefect(DefectStatus.NEW, DefectStatus.RESOLVED)).toBe(true);
    expect(canTransitionDefect(DefectStatus.ACK, DefectStatus.RESOLVED)).toBe(true);
  });

  it('allows reopening from resolved or closed', () => {
    expect(canTransitionDefect(DefectStatus.RESOLVED, DefectStatus.REOPENED)).toBe(true);
    expect(canTransitionDefect(DefectStatus.CLOSED, DefectStatus.REOPENED)).toBe(true);
  });

  it('rejects skipping back to NEW and illegal jumps', () => {
    expect(canTransitionDefect(DefectStatus.CLOSED, DefectStatus.NEW)).toBe(false);
    expect(canTransitionDefect(DefectStatus.NEW, DefectStatus.IN_PROGRESS)).toBe(false);
    expect(canTransitionDefect(DefectStatus.RESOLVED, DefectStatus.IN_PROGRESS)).toBe(false);
  });

  it('treats a no-op transition as invalid', () => {
    expect(canTransitionDefect(DefectStatus.IN_PROGRESS, DefectStatus.IN_PROGRESS)).toBe(false);
  });

  it('never lists a status as a transition to itself', () => {
    for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });
});
