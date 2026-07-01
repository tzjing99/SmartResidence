import { DEFAULT_RECEIPT_TEMPLATE, type ReceiptTemplateConfig } from '@smartresidence/shared-types';

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

/**
 * Read the condo's configurable receipt template from `Condo.settings.billing.receipt`,
 * falling back to sane defaults for any missing field.
 */
export function parseReceiptTemplate(settings: unknown): ReceiptTemplateConfig {
  const billing = asObject(asObject(settings).billing);
  const receipt = asObject(billing.receipt);
  return {
    numberPrefix: str(receipt.numberPrefix, DEFAULT_RECEIPT_TEMPLATE.numberPrefix) || 'RCPT',
    organizationName: str(receipt.organizationName, DEFAULT_RECEIPT_TEMPLATE.organizationName),
    registrationNo: str(receipt.registrationNo, DEFAULT_RECEIPT_TEMPLATE.registrationNo),
    addressLines: str(receipt.addressLines, DEFAULT_RECEIPT_TEMPLATE.addressLines),
    footerNote: str(receipt.footerNote, DEFAULT_RECEIPT_TEMPLATE.footerNote),
    signatoryName: str(receipt.signatoryName, DEFAULT_RECEIPT_TEMPLATE.signatoryName),
    signatoryTitle: str(receipt.signatoryTitle, DEFAULT_RECEIPT_TEMPLATE.signatoryTitle),
    logoUrl: str(receipt.logoUrl, DEFAULT_RECEIPT_TEMPLATE.logoUrl),
  };
}

/**
 * Merge a partial template patch into the existing condo settings JSON,
 * returning the full settings object ready to persist.
 */
export function mergeReceiptTemplate(
  settings: unknown,
  patch: Partial<ReceiptTemplateConfig>,
): JsonObject {
  const base = asObject(settings);
  const billing = asObject(base.billing);
  const current = parseReceiptTemplate(settings);
  return {
    ...base,
    billing: {
      ...billing,
      receipt: { ...current, ...patch },
    },
  };
}
