import { describe, expect, it } from 'vitest';
import { buildCsv } from './csv-utils';
import { buildUnitStatementPdf } from './statement-pdf';

describe('buildCsv', () => {
  it('quotes cells containing commas and quotes', () => {
    expect(buildCsv([['a', 'b,c', 'd"d']])).toBe('"a","b,c","d""d"');
  });
});

describe('buildUnitStatementPdf', () => {
  it('returns a valid PDF buffer', () => {
    const buf = buildUnitStatementPdf({
      organizationName: 'Test JMB',
      unitLabel: 'A-01-1',
      periodFrom: '1 Jan 2026',
      periodTo: '31 Jan 2026',
      openingBalance: 100,
      closingBalance: 40,
      creditBalance: 0,
      entries: [
        {
          occurredAt: '2026-01-10T00:00:00.000Z',
          type: 'PAYMENT',
          fund: 'MAINTENANCE',
          description: 'Payment for INV-1',
          charge: 0,
          payment: 60,
          balance: 40,
        },
      ],
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });
});
