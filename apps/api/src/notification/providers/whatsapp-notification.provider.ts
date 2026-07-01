import { Injectable, Logger } from '@nestjs/common';
import { NotificationKind } from '@prisma/client';
import { WHATSAPP_SUPPORTED_KINDS, buildWhatsAppTemplate } from '../whatsapp-templates';
import type {
  WhatsAppNotificationProvider,
  WhatsAppSendContext,
  WhatsAppSendResult,
  WhatsAppTemplateMessage,
} from './whatsapp-notification.provider.interface';

const GRAPH_API_VERSION = 'v21.0';

/** Notification kinds that can be sent over WhatsApp (v1.0). */
export { WHATSAPP_SUPPORTED_KINDS };

/**
 * Meta WhatsApp Cloud API provider. When credentials or phoneNumberId are missing
 * it logs the would-be message and returns mock mode — same seam pattern as
 * email (Resend) and other integrations.
 */
@Injectable()
export class MetaWhatsAppNotificationProvider implements WhatsAppNotificationProvider {
  private readonly logger = new Logger(MetaWhatsAppNotificationProvider.name);

  buildTemplate(
    ctx: Pick<WhatsAppSendContext, 'kind' | 'title' | 'body' | 'data'>,
  ): WhatsAppTemplateMessage | null {
    return buildWhatsAppTemplate(ctx);
  }

  async send(ctx: WhatsAppSendContext): Promise<WhatsAppSendResult> {
    const template = this.buildTemplate(ctx);
    if (!template) {
      return {
        ok: false,
        mode: 'mock',
        detail: `Notification kind ${ctx.kind} is not supported for WhatsApp`,
      };
    }

    const digits = ctx.toE164.replace(/\D/g, '');
    if (!digits) {
      return { ok: false, mode: 'mock', detail: 'Recipient phone is empty' };
    }

    if (!ctx.credentials?.apiKey || !ctx.phoneNumberId.trim()) {
      this.logger.debug(
        `[whatsapp mock] ${ctx.toE164} · ${template.name}: ${ctx.title} — ${ctx.body.slice(0, 120)}`,
      );
      return {
        ok: true,
        mode: 'mock',
        detail: 'No WhatsApp credentials configured — logged only',
      };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${ctx.phoneNumberId.trim()}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: digits,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.languageCode },
        components: [
          {
            type: 'body',
            parameters: template.bodyParameters.map((text) => ({
              type: 'text',
              text: text.slice(0, 1024),
            })),
          },
        ],
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (!res.ok) {
        const msg = json.error?.message ?? res.statusText;
        this.logger.warn(`WhatsApp send to ${ctx.toE164} failed: ${msg}`);
        return { ok: false, mode: 'live', detail: msg };
      }
      const messageId = json.messages?.[0]?.id;
      this.logger.log(`WhatsApp ${template.name} sent to ${ctx.toE164} (${messageId ?? 'ok'})`);
      return {
        ok: true,
        mode: 'live',
        messageId,
        detail: 'Message accepted by Meta',
      };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`WhatsApp send to ${ctx.toE164} failed: ${msg}`);
      return { ok: false, mode: 'live', detail: msg };
    }
  }
}

/** True when a notification kind is eligible for WhatsApp delivery. */
export function isWhatsAppSupportedKind(kind: NotificationKind): boolean {
  return (WHATSAPP_SUPPORTED_KINDS as readonly NotificationKind[]).includes(kind);
}
