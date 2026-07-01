import { describe, expect, it } from 'vitest';
import { COMMON_FEE_SCHEDULE_PRESETS, resolveFeeScheduleExtraLineFund } from './billing';

describe('resolveFeeScheduleExtraLineFund', () => {
  it('accepts an explicit allowed fund', () => {
    expect(resolveFeeScheduleExtraLineFund({ fund: 'SINKING_FUND' })).toBe('SINKING_FUND');
  });

  it('infers fund from category when fund is omitted', () => {
    expect(resolveFeeScheduleExtraLineFund({ category: 'FIRE_INSURANCE' })).toBe('SINKING_FUND');
    expect(resolveFeeScheduleExtraLineFund({ category: 'QUIT_RENT' })).toBe('MAINTENANCE');
  });

  it('rejects General fund', () => {
    expect(() => resolveFeeScheduleExtraLineFund({ fund: 'GENERAL' })).toThrow(/General fund/);
  });

  it('requires fund or category', () => {
    expect(() => resolveFeeScheduleExtraLineFund({})).toThrow(/Select a fund/);
  });
});

describe('COMMON_FEE_SCHEDULE_PRESETS', () => {
  it('maps every preset to an allowed fund with labels', () => {
    for (const preset of COMMON_FEE_SCHEDULE_PRESETS) {
      expect(['MAINTENANCE', 'SINKING_FUND', 'DEPOSIT']).toContain(preset.fund);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it('includes featured strata presets with clear labels', () => {
    const labels = COMMON_FEE_SCHEDULE_PRESETS.map((p) => p.label);
    expect(labels).toContain('Fire insurance (sinking)');
    expect(labels).toContain('Quit rent (maintenance)');
    expect(labels).toContain('Sinking fund contribution');
  });
});
