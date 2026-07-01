import { DEFAULT_EINVOICE_CONFIG, type EInvoiceConfig } from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';
import { buildEInvoiceDocument, validateEInvoiceDocument } from './document-builder';
import { SandboxMyInvoisProvider } from './providers/sandbox-myinvois.provider';

const validConfig: EInvoiceConfig = {
  ...DEFAULT_EINVOICE_CONFIG,
  enabled: true,
  supplierTin: 'C1234567890',
  supplierName: 'Sunrise Residence JMB',
  registrationNo: '202301012345',
  msicCode: '68200',
  businessActivityDescription: 'Real estate management services',
  addressLine1: 'Level 1, Management Office',
  city: 'Kuala Lumpur',
  postcode: '50000',
  state: '14',
  countryCode: 'MYS',
  defaultTaxType: '06',
  defaultTaxRate: 0,
};

function buildDoc(config: EInvoiceConfig) {
  return buildEInvoiceDocument({
    invoiceNumber: 'INV-2026-000001',
    issuedAt: new Date('2026-07-01T09:30:00.000Z'),
    currencyCode: 'MYR',
    config,
    lines: [
      { description: 'Monthly maintenance fee', quantity: 1, unitPrice: 250, amount: 250 },
      { description: 'Sinking fund', quantity: 1, unitPrice: 40, amount: 40 },
    ],
    buyer: { name: 'Unit A-1-1' },
  });
}

describe('buildEInvoiceDocument', () => {
  it('produces core UBL fields with MYR totals (no tax)', () => {
    const doc = buildDoc(validConfig);
    expect(doc.documentCurrencyCode).toBe('MYR');
    expect(doc.invoiceNumber).toBe('INV-2026-000001');
    expect(doc.issueDate).toBe('2026-07-01');
    expect(doc.supplier.tin).toBe('C1234567890');
    expect(doc.lines).toHaveLength(2);
    expect(doc.taxExclusiveAmount).toBe(290);
    expect(doc.taxAmount).toBe(0);
    expect(doc.totalPayableAmount).toBe(290);
  });

  it('computes per-line tax when a default rate is set', () => {
    const doc = buildDoc({ ...validConfig, defaultTaxType: '02', defaultTaxRate: 6 });
    expect(doc.lines[0].taxAmount).toBe(15);
    expect(doc.taxAmount).toBe(17.4);
    expect(doc.totalPayableAmount).toBe(307.4);
  });

  it('defaults the buyer TIN to the LHDN general public identifier', () => {
    const doc = buildDoc(validConfig);
    expect(doc.buyer.tin).toBe('EI00000000010');
  });

  it('reports missing required supplier fields', () => {
    const doc = buildDoc({ ...validConfig, msicCode: '', supplierTin: '' });
    const missing = validateEInvoiceDocument(doc);
    expect(missing).toContain('Supplier TIN');
    expect(missing).toContain('MSIC business code');
  });
});

describe('SandboxMyInvoisProvider', () => {
  const provider = new SandboxMyInvoisProvider();

  it('validates a well-formed document to VALID with a QR/verification URL', async () => {
    const result = await provider.submit({
      document: buildDoc(validConfig),
      environment: 'SANDBOX',
    });
    expect(result.status).toBe('VALID');
    expect(result.uuid).toBeTruthy();
    expect(result.longId).toBeTruthy();
    expect(result.validationUrl).toContain(result.uuid);
    expect(result.qrPayload).toBe(result.validationUrl);
    expect(result.error).toBeUndefined();
  });

  it('rejects a document missing required fields as INVALID', async () => {
    const result = await provider.submit({
      document: buildDoc({ ...validConfig, msicCode: '' }),
      environment: 'SANDBOX',
    });
    expect(result.status).toBe('INVALID');
    expect(result.error).toContain('MSIC business code');
  });

  it('cancels an e-invoice', async () => {
    const result = await provider.cancel('uuid-123', 'duplicate', 'SANDBOX');
    expect(result.status).toBe('CANCELLED');
  });
});
