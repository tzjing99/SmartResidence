import {
  DEFAULT_EINVOICE_CONFIG,
  type EInvoiceConfig,
  EInvoiceConfigSchema,
} from '@smartresidence/shared-types';

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};

/** Encrypted-at-rest LHDN API credentials, stored base64 inside the settings JSON. */
export interface EInvoiceSecretEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

/**
 * Read the condo's LHDN MyInvois config from `condo.settings.einvoice`, falling
 * back to defaults for any missing field. The encrypted API secret is stripped.
 */
export function parseEInvoiceConfig(settings: unknown): EInvoiceConfig {
  const einvoice = asObject(asObject(settings).einvoice);
  const { secret: _secret, ...rest } = einvoice;
  return EInvoiceConfigSchema.parse(rest);
}

/**
 * Merge a partial config patch into the condo settings JSON, preserving the
 * stored encrypted secret and any unrelated settings, and return the full
 * settings object ready to persist.
 */
export function mergeEInvoiceConfig(settings: unknown, patch: Partial<EInvoiceConfig>): JsonObject {
  const base = asObject(settings);
  const einvoice = asObject(base.einvoice);
  const current = parseEInvoiceConfig(settings);
  const merged = EInvoiceConfigSchema.parse({ ...current, ...patch });
  return {
    ...base,
    einvoice: {
      ...merged,
      ...(einvoice.secret ? { secret: einvoice.secret } : {}),
    },
  };
}

/** Read the stored encrypted API-secret envelope, if configured. */
export function readEInvoiceSecret(settings: unknown): EInvoiceSecretEnvelope | null {
  const secret = asObject(asObject(asObject(settings).einvoice).secret);
  if (
    typeof secret.ciphertext === 'string' &&
    typeof secret.iv === 'string' &&
    typeof secret.authTag === 'string'
  ) {
    return {
      ciphertext: secret.ciphertext,
      iv: secret.iv,
      authTag: secret.authTag,
      keyVersion: typeof secret.keyVersion === 'number' ? secret.keyVersion : 1,
    };
  }
  return null;
}

/** True when the condo has stored LHDN API credentials. */
export function hasEInvoiceSecret(settings: unknown): boolean {
  return readEInvoiceSecret(settings) !== null;
}

/** Persist a new encrypted API-secret envelope into the settings JSON. */
export function writeEInvoiceSecret(
  settings: unknown,
  envelope: EInvoiceSecretEnvelope,
): JsonObject {
  const base = asObject(settings);
  const einvoice = { ...asObject(base.einvoice), secret: envelope };
  return { ...base, einvoice };
}

export { DEFAULT_EINVOICE_CONFIG };
