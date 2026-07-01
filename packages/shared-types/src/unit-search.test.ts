import { describe, expect, it } from 'vitest';
import { formatCompactUnitLabel } from './unit-search';

describe('formatCompactUnitLabel', () => {
  it('does not duplicate a block prefix already in the identifier', () => {
    expect(formatCompactUnitLabel({ block: { name: 'A' }, identifier: 'A-04-3' })).toBe('A-04-3');
  });

  it('prefixes identifiers that do not include the block', () => {
    expect(formatCompactUnitLabel({ block: { name: 'A' }, identifier: '04-3' })).toBe('A-04-3');
  });

  it('matches embedded block prefixes case-insensitively', () => {
    expect(formatCompactUnitLabel({ block: { name: 'A' }, identifier: 'a-04-3' })).toBe('a-04-3');
  });

  it('falls back to the identifier when no block is available', () => {
    expect(formatCompactUnitLabel({ identifier: '04-3' })).toBe('04-3');
  });
});
