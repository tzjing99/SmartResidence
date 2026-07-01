import { z } from 'zod';

/**
 * Per-condo WhatsApp Cloud API configuration stored under `condo.settings.whatsapp`.
 * The Meta API access token is envelope-encrypted separately and never returned.
 */
export const WhatsAppConfigSchema = z.object({
  /** Master switch — residents only receive WhatsApp when this is on and they opt in. */
  enabled: z.boolean().default(false),
  /** Meta WhatsApp Business phone number ID (public, used in API path). */
  phoneNumberId: z.string().default(''),
  /** Meta WhatsApp Business account ID (public metadata). */
  businessAccountId: z.string().default(''),
});
export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = WhatsAppConfigSchema.parse({});

/** Sanitised config returned to admin clients. */
export interface WhatsAppConfigView extends WhatsAppConfig {
  /** True when a Meta API access token is stored (never the value). */
  apiKeyConfigured: boolean;
  updatedAt?: string;
}

/** Update payload; credentials are write-only. */
export const UpdateWhatsAppConfigSchema = WhatsAppConfigSchema.partial().extend({
  /** Meta WhatsApp Cloud API permanent access token (write-only; stored encrypted). */
  apiKey: z.string().optional(),
});
export type UpdateWhatsAppConfigInput = z.infer<typeof UpdateWhatsAppConfigSchema>;

/** Result of an admin test send. */
export interface WhatsAppTestSendResult {
  ok: boolean;
  mode: 'live' | 'mock';
  messageId?: string;
  detail: string;
}
