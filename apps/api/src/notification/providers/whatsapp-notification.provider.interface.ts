import type { NotificationKind } from '@prisma/client';

export const WHATSAPP_NOTIFICATION_PROVIDER = Symbol('WHATSAPP_NOTIFICATION_PROVIDER');

/** Decrypted Meta Cloud API credentials (never persisted or returned to clients). */
export interface WhatsAppCredentials {
  apiKey: string;
}

export interface WhatsAppTemplateMessage {
  /** Pre-approved Meta template name, e.g. `sr_parcel_received`. */
  name: string;
  languageCode: string;
  bodyParameters: string[];
}

export interface WhatsAppSendContext {
  phoneNumberId: string;
  credentials: WhatsAppCredentials | null;
  toE164: string;
  kind: NotificationKind;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface WhatsAppSendResult {
  ok: boolean;
  mode: 'live' | 'mock';
  messageId?: string;
  detail: string;
}

export interface WhatsAppNotificationProvider {
  /** Build the Meta template payload for a notification kind (null when unsupported). */
  buildTemplate(
    ctx: Pick<WhatsAppSendContext, 'kind' | 'title' | 'body' | 'data'>,
  ): WhatsAppTemplateMessage | null;

  /** Deliver a template message via Meta Cloud API, or log in mock mode. */
  send(ctx: WhatsAppSendContext): Promise<WhatsAppSendResult>;
}
