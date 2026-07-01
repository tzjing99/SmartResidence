import { describe, expect, it } from 'vitest';
import { buildCobTemplatePdf } from './cob-pdf';
import type { CobPrefillContext } from './cob-prefill';

const sampleCtx: CobPrefillContext = {
  organizationName: 'Pangsapuri Harmoni JMB',
  registrationNo: 'JMB-WP-2021-0098',
  address: 'Jalan Harmoni 1, 43000 Kajang, Selangor',
  blockCount: 2,
  unitCount: 120,
  asAtDate: new Date('2026-06-30T00:00:00.000Z'),
  reportingFrom: new Date('2026-01-01T00:00:00.000Z'),
  reportingTo: new Date('2026-06-30T00:00:00.000Z'),
  managementCommittee: [
    { name: 'Ahmad bin Ali', role: 'Chairman', email: 'ahmad@example.com' },
    { name: 'Lee Mei Ling', role: 'Secretary', email: 'lee@example.com' },
  ],
  fundBalances: [
    { fund: 'MAINTENANCE', label: 'Maintenance account', balanceFormatted: 'RM 45,230.00' },
    { fund: 'SINKING_FUND', label: 'Sinking fund', balanceFormatted: 'RM 128,400.00' },
  ],
  fundSummaryRows: [
    {
      fund: 'MAINTENANCE',
      openingBalance: 40000,
      collections: 12000,
      chargesIssued: 8000,
      adjustments: 0,
      closingBalance: 45230,
    },
    {
      fund: 'SINKING_FUND',
      openingBalance: 120000,
      collections: 10000,
      chargesIssued: 2000,
      adjustments: 400,
      closingBalance: 128400,
    },
  ],
  signatoryName: 'Ahmad bin Ali',
  signatoryTitle: 'Hon. Secretary',
};

describe('buildCobTemplatePdf', () => {
  const kinds = [
    'ANNUAL_RETURN',
    'FINANCIAL_SUMMARY',
    'MEETING_MINUTES_COVER',
    'INSURANCE_REGISTER',
  ] as const;

  for (const kind of kinds) {
    it(`returns a valid PDF for ${kind}`, () => {
      const buf = buildCobTemplatePdf(kind, sampleCtx);
      expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(buf.length).toBeGreaterThan(800);
    });
  }

  it('embeds organization name in PDF stream', () => {
    const buf = buildCobTemplatePdf('ANNUAL_RETURN', sampleCtx);
    const text = buf.toString('latin1');
    expect(text).toContain('Pangsapuri Harmoni JMB');
  });
});
