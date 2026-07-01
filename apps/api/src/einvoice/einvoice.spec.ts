import { createHash } from 'node:crypto';
import { DEFAULT_EINVOICE_CONFIG, type EInvoiceConfig } from '@smartresidence/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { buildEInvoiceDocument, validateEInvoiceDocument } from './document-builder';
import {
  DelegatingMyInvoisProvider,
  shouldUseProductionMyInvois,
} from './providers/delegating-myinvois.provider';
import { encodeMyInvoisDocument } from './providers/myinvois-document.mapper';
import {
  clearMyInvoisTokenCache,
  fetchMyInvoisAccessToken,
} from './providers/myinvois-oauth.client';
import {
  mapMyInvoisStatus,
  parseCancelResponse,
  parseSubmissionResponse,
} from './providers/myinvois-response.parser';
import { ProductionMyInvoisProvider } from './providers/production-myinvois.provider';
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

describe('DelegatingMyInvoisProvider', () => {
  const sandbox = new SandboxMyInvoisProvider();
  const production = new ProductionMyInvoisProvider(vi.fn());
  const delegating = new DelegatingMyInvoisProvider(sandbox, production);

  it('uses sandbox for SANDBOX environment', () => {
    expect(delegating.resolveProviderId('SANDBOX')).toBe('sandbox');
    expect(shouldUseProductionMyInvois('SANDBOX', { clientId: 'a', clientSecret: 'b' })).toBe(
      false,
    );
  });

  it('uses production when PRODUCTION and credentials are present', () => {
    expect(
      delegating.resolveProviderId('PRODUCTION', { clientId: 'id', clientSecret: 'secret' }),
    ).toBe('production');
    expect(
      shouldUseProductionMyInvois('PRODUCTION', { clientId: 'id', clientSecret: 'secret' }),
    ).toBe(true);
  });

  it('falls back to sandbox for PRODUCTION without credentials', () => {
    expect(delegating.resolveProviderId('PRODUCTION')).toBe('sandbox');
    expect(shouldUseProductionMyInvois('PRODUCTION')).toBe(false);
  });
});

describe('encodeMyInvoisDocument', () => {
  it('produces base64 payload and matching SHA-256 hash', () => {
    const doc = buildDoc(validConfig);
    const encoded = encodeMyInvoisDocument(doc);
    expect(encoded.format).toBe('JSON');
    expect(encoded.codeNumber).toBe(doc.invoiceNumber);
    const json = Buffer.from(encoded.document, 'base64').toString('utf8');
    const hash = createHash('sha256').update(json, 'utf8').digest('hex');
    expect(encoded.documentHash).toBe(hash);
  });
});

describe('myinvois response parsers', () => {
  it('maps LHDN status strings', () => {
    expect(mapMyInvoisStatus('Valid')).toBe('VALID');
    expect(mapMyInvoisStatus('Invalid')).toBe('INVALID');
    expect(mapMyInvoisStatus('Cancelled')).toBe('CANCELLED');
    expect(mapMyInvoisStatus('Submitted')).toBe('PENDING');
  });

  it('parses submission acceptance', () => {
    const parsed = parseSubmissionResponse({
      submissionUid: 'SUB123',
      acceptedDocuments: [{ uuid: 'DOC-UUID', longId: 'LONGID' }],
    });
    expect(parsed.submissionUid).toBe('SUB123');
    expect(parsed.uuid).toBe('DOC-UUID');
    expect(parsed.status).toBe('PENDING');
  });

  it('parses cancel success', () => {
    const parsed = parseCancelResponse({ uuid: 'DOC-UUID', status: 'Cancelled' });
    expect(parsed.status).toBe('CANCELLED');
  });
});

describe('ProductionMyInvoisProvider', () => {
  const creds = { clientId: 'client-id', clientSecret: 'client-secret' };

  it('returns INVALID when credentials are missing', async () => {
    const provider = new ProductionMyInvoisProvider(vi.fn());
    const result = await provider.submit({
      document: buildDoc(validConfig),
      environment: 'PRODUCTION',
    });
    expect(result.status).toBe('INVALID');
    expect(result.error).toContain('client id');
  });

  it('submits via OAuth and documents API with mocked fetch', async () => {
    clearMyInvoisTokenCache();
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes('/connect/token')) {
        return new Response(JSON.stringify({ access_token: 'token-abc', expires_in: 3600 }), {
          status: 200,
        });
      }
      if (href.includes('/documentsubmissions') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            submissionUid: 'SUB-001',
            acceptedDocuments: [{ uuid: 'LHDN-UUID', longId: 'LONG-123' }],
          }),
          { status: 200 },
        );
      }
      if (href.includes('/documentsubmissions/SUB-001')) {
        return new Response(
          JSON.stringify({
            overallStatus: 'Valid',
            documentSummary: [{ uuid: 'LHDN-UUID', longId: 'LONG-123', status: 'Valid' }],
          }),
          { status: 200 },
        );
      }
      if (href.includes('/documents/LHDN-UUID/details')) {
        return new Response(
          JSON.stringify({ uuid: 'LHDN-UUID', longId: 'LONG-123', status: 'Valid' }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const provider = new ProductionMyInvoisProvider(fetchMock as typeof fetch);
    const result = await provider.submit({
      document: buildDoc(validConfig),
      environment: 'PRODUCTION',
      credentials: creds,
    });

    expect(result.status).toBe('VALID');
    expect(result.uuid).toBe('LHDN-UUID');
    expect(result.longId).toBe('LONG-123');
    expect(result.submissionUid).toBe('SUB-001');
    expect(result.validationUrl).toContain('LHDN-UUID');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('caches OAuth tokens', async () => {
    clearMyInvoisTokenCache();
    const fetchMock = vi.fn(async () =>
      Response.json({ access_token: 'cached-token', expires_in: 3600 }),
    );
    await fetchMyInvoisAccessToken('PRODUCTION', creds, fetchMock as typeof fetch);
    await fetchMyInvoisAccessToken('PRODUCTION', creds, fetchMock as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
