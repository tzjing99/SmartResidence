import {
  formatUnitLabel,
  normalizeUnitSearchTerm,
  parseCompositeUnitLabel,
} from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';
import { buildUnitSearchOrConditions } from '../src/tenant/unit-search';

describe('formatUnitLabel', () => {
  it('shows composite identifier without redundant block prefix', () => {
    expect(
      formatUnitLabel({
        id: 'u1',
        identifier: 'A-01-1',
        block: { name: 'A' },
      }),
    ).toBe('A-01-1');
    expect(
      formatUnitLabel({
        id: 'u2',
        identifier: 'A-05-2',
        block: { name: 'A' },
        ownerships: [{ user: { name: 'Aisyah binti Rahman' } }],
      }),
    ).toBe('A-05-2 — Aisyah binti Rahman');
  });

  it('uses plain-language block + unit when stored separately', () => {
    expect(
      formatUnitLabel({
        id: 'u3',
        identifier: '01-1',
        block: { name: 'A' },
        ownerships: [{ user: { name: 'Tan Wei Ming' } }],
      }),
    ).toBe('Block A · Unit 01-1 — Tan Wei Ming');
  });
});

describe('normalizeUnitSearchTerm', () => {
  it('strips block prefix and owner suffix from picker labels', () => {
    expect(normalizeUnitSearchTerm('A · 01-1 — Tan Wei Ming')).toBe('01-1');
    expect(normalizeUnitSearchTerm('A · A-01-1')).toBe('A-01-1');
    expect(normalizeUnitSearchTerm('A-01-1 — Tan Wei Ming')).toBe('A-01-1');
    expect(normalizeUnitSearchTerm('Block A · Unit 01-1 — Tan Wei Ming')).toBe('01-1');
  });

  it('returns trimmed raw input when not a picker label', () => {
    expect(normalizeUnitSearchTerm('  A-01-1  ')).toBe('A-01-1');
  });
});

describe('parseCompositeUnitLabel', () => {
  it('parses block-floor-unit style labels', () => {
    expect(parseCompositeUnitLabel('A-01-1')).toEqual({ block: 'A', rest: '01-1' });
    expect(parseCompositeUnitLabel('B 12-3')).toEqual({ block: 'B', rest: '12-3' });
  });
});

describe('buildUnitSearchOrConditions', () => {
  it('adds composite block+identifier match for A-01-1', () => {
    const conditions = buildUnitSearchOrConditions('A-01-1');
    expect(conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          AND: [
            { block: { name: { equals: 'A', mode: 'insensitive' } } },
            {
              OR: [
                { identifier: { equals: '01-1', mode: 'insensitive' } },
                { identifier: { contains: '01-1', mode: 'insensitive' } },
              ],
            },
          ],
        }),
      ]),
    );
  });
});
