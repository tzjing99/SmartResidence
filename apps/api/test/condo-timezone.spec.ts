import { describe, expect, it } from 'vitest';
import { condoDayBounds, zonedDayKey } from '../src/visitor/condo-timezone';

describe('condo-timezone', () => {
  it('resolves day bounds in Asia/Kuala_Lumpur', () => {
    const instant = new Date('2026-06-08T10:30:00.000Z');
    const { start, end } = condoDayBounds('Asia/Kuala_Lumpur', instant);
    expect(zonedDayKey(start, 'Asia/Kuala_Lumpur')).toBe('2026-06-08');
    expect(zonedDayKey(end, 'Asia/Kuala_Lumpur')).toBe('2026-06-09');
    expect(instant.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(instant.getTime()).toBeLessThan(end.getTime());
  });

  it('day bounds span exactly 24 hours in UTC', () => {
    const { start, end } = condoDayBounds('UTC', new Date('2026-06-08T15:00:00.000Z'));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
