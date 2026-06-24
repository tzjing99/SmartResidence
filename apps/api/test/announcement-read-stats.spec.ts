import { describe, expect, it } from 'vitest';

/** Mirrors percentage logic in AnnouncementService.getReadStats. */
function readStats(readCount: number, ackCount: number, recipientCount: number) {
  const pct = (n: number) => (recipientCount > 0 ? Math.round((n / recipientCount) * 100) : 0);
  return {
    recipientCount,
    readCount,
    ackCount,
    readPercent: pct(readCount),
    ackPercent: pct(ackCount),
  };
}

describe('announcement read stats', () => {
  it('computes percentages scoped to recipient count', () => {
    expect(readStats(3, 2, 10)).toEqual({
      recipientCount: 10,
      readCount: 3,
      ackCount: 2,
      readPercent: 30,
      ackPercent: 20,
    });
  });

  it('returns zero percentages when there are no recipients', () => {
    expect(readStats(0, 0, 0)).toEqual({
      recipientCount: 0,
      readCount: 0,
      ackCount: 0,
      readPercent: 0,
      ackPercent: 0,
    });
  });

  it('rounds read percentage to nearest integer', () => {
    expect(readStats(1, 0, 3).readPercent).toBe(33);
  });
});
