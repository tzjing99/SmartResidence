import { NotificationKind } from '@prisma/client';
import type { WhatsAppTemplateMessage } from './providers/whatsapp-notification.provider.interface';

/** Transactional notification kinds supported in WhatsApp v1.0. */
export const WHATSAPP_SUPPORTED_KINDS = [
  NotificationKind.PARCEL_RECEIVED,
  NotificationKind.VISITOR_CHECKED_IN,
  NotificationKind.INVOICE_DUE_SOON,
] as const;

type TemplateCtx = {
  kind: NotificationKind;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Map in-app notifications to pre-approved Meta template names.
 * Templates must be created and approved in Meta Business Manager.
 */
export function buildWhatsAppTemplate(ctx: TemplateCtx): WhatsAppTemplateMessage | null {
  switch (ctx.kind) {
    case NotificationKind.PARCEL_RECEIVED: {
      const recipient =
        typeof ctx.data?.recipientName === 'string' ? ctx.data.recipientName : ctx.title;
      const unit =
        typeof ctx.data?.unitLabel === 'string'
          ? ctx.data.unitLabel
          : (ctx.body.split(' — ').pop() ?? ctx.body);
      return {
        name: 'sr_parcel_received',
        languageCode: 'en',
        bodyParameters: [recipient.slice(0, 200), unit.slice(0, 200)],
      };
    }
    case NotificationKind.VISITOR_CHECKED_IN: {
      const visitor = ctx.title
        .replace(/^Walk-in admitted: /, '')
        .replace(/ arrived at the gate$/, '');
      const detail = ctx.body.slice(0, 200);
      return {
        name: 'sr_visitor_arrived',
        languageCode: 'en',
        bodyParameters: [visitor.slice(0, 200), detail],
      };
    }
    case NotificationKind.INVOICE_DUE_SOON: {
      const invoiceNo =
        typeof ctx.data?.invoiceNumber === 'string'
          ? ctx.data.invoiceNumber
          : ctx.title
              .replace(/^Invoice /, '')
              .replace(/ due soon$/, '')
              .replace(/ is overdue$/, '');
      return {
        name: 'sr_invoice_due',
        languageCode: 'en',
        bodyParameters: [invoiceNo.slice(0, 200), ctx.body.slice(0, 200)],
      };
    }
    default:
      return null;
  }
}
