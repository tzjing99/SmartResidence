import {
  DEFAULT_WHATSAPP_CONFIG,
  type WhatsAppConfig,
  WhatsAppConfigSchema,
} from '@smartresidence/shared-types';

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};

/** Encrypted-at-rest Meta API token, stored base64 inside the settings JSON. */
export interface WhatsAppSecretEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

/** Read the condo WhatsApp config from `condo.settings.whatsapp`. */
export function parseWhatsAppConfig(settings: unknown): WhatsAppConfig {
  const whatsapp = asObject(asObject(settings).whatsapp);
  const { secret: _secret, ...rest } = whatsapp;
  return WhatsAppConfigSchema.parse(rest);
}

/** Merge a partial patch, preserving the encrypted secret and unrelated settings. */
export function mergeWhatsAppConfig(settings: unknown, patch: Partial<WhatsAppConfig>): JsonObject {
  const base = asObject(settings);
  const whatsapp = asObject(base.whatsapp);
  const current = parseWhatsAppConfig(settings);
  const merged = WhatsAppConfigSchema.parse({ ...current, ...patch });
  return {
    ...base,
    whatsapp: {
      ...merged,
      ...(whatsapp.secret ? { secret: whatsapp.secret } : {}),
    },
  };
}

export function readWhatsAppSecret(settings: unknown): WhatsAppSecretEnvelope | null {
  const secret = asObject(asObject(asObject(settings).whatsapp).secret);
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

export function hasWhatsAppSecret(settings: unknown): boolean {
  return readWhatsAppSecret(settings) !== null;
}

export function writeWhatsAppSecret(
  settings: unknown,
  envelope: WhatsAppSecretEnvelope,
): JsonObject {
  const base = asObject(settings);
  const whatsapp = { ...asObject(base.whatsapp), secret: envelope };
  return { ...base, whatsapp };
}

export { DEFAULT_WHATSAPP_CONFIG };
