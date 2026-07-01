import { NotificationKind } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { MetaWhatsAppNotificationProvider } from './providers/whatsapp-notification.provider';
import { mergeWhatsAppConfig, parseWhatsAppConfig, writeWhatsAppSecret } from './whatsapp-settings';
import { WHATSAPP_SUPPORTED_KINDS, buildWhatsAppTemplate } from './whatsapp-templates';

describe('parseWhatsAppConfig', () => {
  it('returns defaults when settings are empty', () => {
    expect(parseWhatsAppConfig({})).toEqual({
      enabled: false,
      phoneNumberId: '',
      businessAccountId: '',
    });
  });

  it('merges patches without dropping the encrypted secret', () => {
    const settings = writeWhatsAppSecret(
      {},
      {
        ciphertext: 'abc',
        iv: 'iv',
        authTag: 'tag',
        keyVersion: 1,
      },
    );
    const merged = mergeWhatsAppConfig(settings, { enabled: true, phoneNumberId: '123' });
    const whatsapp = merged.whatsapp as Record<string, unknown>;
    expect(whatsapp.enabled).toBe(true);
    expect(whatsapp.phoneNumberId).toBe('123');
    expect(whatsapp.secret).toBeTruthy();
  });
});

describe('buildWhatsAppTemplate', () => {
  it('maps parcel received to sr_parcel_received', () => {
    const tpl = buildWhatsAppTemplate({
      kind: NotificationKind.PARCEL_RECEIVED,
      title: 'Parcel received',
      body: 'A parcel for Jane — Unit B-02-03.',
      data: { recipientName: 'Jane', unitLabel: 'Unit B-02-03' },
    });
    expect(tpl?.name).toBe('sr_parcel_received');
    expect(tpl?.bodyParameters).toEqual(['Jane', 'Unit B-02-03']);
  });

  it('maps visitor checked in to sr_visitor_arrived', () => {
    const tpl = buildWhatsAppTemplate({
      kind: NotificationKind.VISITOR_CHECKED_IN,
      title: 'Ali arrived at the gate',
      body: 'Checked in at 14:30 · A-01-01.',
    });
    expect(tpl?.name).toBe('sr_visitor_arrived');
    expect(tpl?.bodyParameters[0]).toBe('Ali');
  });

  it('maps invoice due to sr_invoice_due', () => {
    const tpl = buildWhatsAppTemplate({
      kind: NotificationKind.INVOICE_DUE_SOON,
      title: 'Invoice INV-001 due soon',
      body: 'RM 250.00 is due 1/8/2026.',
      data: { invoiceNumber: 'INV-001' },
    });
    expect(tpl?.name).toBe('sr_invoice_due');
    expect(tpl?.bodyParameters[0]).toBe('INV-001');
  });

  it('returns null for unsupported kinds', () => {
    expect(
      buildWhatsAppTemplate({
        kind: NotificationKind.ANNOUNCEMENT,
        title: 'News',
        body: 'Hello',
      }),
    ).toBeNull();
  });
});

describe('MetaWhatsAppNotificationProvider', () => {
  const provider = new MetaWhatsAppNotificationProvider();

  it('logs in mock mode when credentials are missing', async () => {
    const result = await provider.send({
      phoneNumberId: '123',
      credentials: null,
      toE164: '+60123456789',
      kind: WHATSAPP_SUPPORTED_KINDS[0],
      title: 'Parcel received',
      body: 'Test body',
      data: { recipientName: 'Test', unitLabel: 'A-01' },
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('mock');
  });

  it('rejects unsupported notification kinds', async () => {
    const result = await provider.send({
      phoneNumberId: '123',
      credentials: { apiKey: 'token' },
      toE164: '+60123456789',
      kind: NotificationKind.ANNOUNCEMENT,
      title: 'News',
      body: 'Hello',
    });
    expect(result.ok).toBe(false);
  });
});
