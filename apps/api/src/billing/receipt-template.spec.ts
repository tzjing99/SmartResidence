import { describe, expect, it } from 'vitest';
import { mergeReceiptTemplate, parseReceiptTemplate } from './receipt-template';

describe('receipt template', () => {
  it('falls back to defaults when unset', () => {
    const t = parseReceiptTemplate(undefined);
    expect(t.numberPrefix).toBe('RCPT');
    expect(t.signatoryTitle).toBe('Authorised Signatory');
  });

  it('reads nested billing.receipt config', () => {
    const settings = {
      billing: { receipt: { organizationName: 'Acacia JMB', numberPrefix: 'AR' } },
    };
    const t = parseReceiptTemplate(settings);
    expect(t.organizationName).toBe('Acacia JMB');
    expect(t.numberPrefix).toBe('AR');
  });

  it('merges a patch without dropping existing fields or other settings', () => {
    const settings = {
      visitor: { keep: true },
      billing: { receipt: { organizationName: 'Acacia JMB' } },
    };
    const merged = mergeReceiptTemplate(settings, { footerNote: 'Thank you' }) as {
      visitor: unknown;
      billing: { receipt: Record<string, string> };
    };
    expect(merged.visitor).toEqual({ keep: true });
    expect(merged.billing.receipt.organizationName).toBe('Acacia JMB');
    expect(merged.billing.receipt.footerNote).toBe('Thank you');
  });
});
