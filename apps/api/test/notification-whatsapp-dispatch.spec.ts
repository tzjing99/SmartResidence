import type { AppEnv } from '@/config/env.schema';
import { NotificationService } from '@/notification/notification.service';
import type { WhatsAppNotificationProvider } from '@/notification/providers/whatsapp-notification.provider.interface';
import type { WhatsAppConfigService } from '@/notification/whatsapp-config.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

function makeService(opts: {
  whatsappNotifications?: boolean;
  phoneVerified?: boolean;
  whatsappEnabled?: boolean;
}) {
  const whatsappSend = vi.fn(async () => ({ ok: true, mode: 'mock' as const }));
  const whatsappProvider = { send: whatsappSend } as unknown as WhatsAppNotificationProvider;
  const whatsappConfig = {
    resolveForDispatch: vi.fn(async () =>
      opts.whatsappEnabled === false
        ? null
        : {
            phoneNumberId: '123',
            credentials: null,
          },
    ),
  } as unknown as WhatsAppConfigService;

  const prisma = {
    user: {
      findMany: vi.fn(async () => [
        {
          id: 'user-1',
          email: 'u@b.c',
          phone: '+60123456789',
          phoneVerifiedAt: opts.phoneVerified === false ? null : new Date(),
          preferences: {
            whatsappNotifications: opts.whatsappNotifications ?? true,
          },
        },
      ]),
    },
    notification: { createMany: vi.fn(async () => ({ count: 1 })) },
    pushSubscription: { findMany: vi.fn(async () => []) },
  } as unknown as PrismaService;

  const config = {
    get: vi.fn(() => undefined),
  } as unknown as ConfigService<AppEnv, true>;

  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  const service = new NotificationService(prisma, config, events, whatsappConfig, whatsappProvider);

  return { service, whatsappSend, whatsappConfig, prisma };
}

describe('NotificationService WhatsApp dispatch', () => {
  it('skips WhatsApp when condo channel is not configured', async () => {
    const { service, whatsappSend } = makeService({ whatsappEnabled: false });
    await service.dispatch({
      userIds: ['user-1'],
      kind: NotificationKind.PARCEL_RECEIVED,
      title: 'Parcel received',
      body: 'A parcel is waiting at the guard house.',
      condoId: 'condo-1',
    });
    expect(whatsappSend).not.toHaveBeenCalled();
  });

  it('respects user whatsappNotifications opt-in', async () => {
    const { service, whatsappSend } = makeService({ whatsappNotifications: false });
    await service.dispatch({
      userIds: ['user-1'],
      kind: NotificationKind.PARCEL_RECEIVED,
      title: 'Parcel received',
      body: 'A parcel is waiting at the guard house.',
      condoId: 'condo-1',
    });
    expect(whatsappSend).not.toHaveBeenCalled();
  });

  it('sends WhatsApp in mock mode when opted in and phone verified', async () => {
    const { service, whatsappSend } = makeService({});
    await service.dispatch({
      userIds: ['user-1'],
      kind: NotificationKind.PARCEL_RECEIVED,
      title: 'Parcel received',
      body: 'A parcel is waiting at the guard house.',
      condoId: 'condo-1',
      data: { recipientName: 'Jane', unitLabel: 'A-01-1' },
    });
    expect(whatsappSend).toHaveBeenCalledWith(
      expect.objectContaining({
        toE164: '+60123456789',
        credentials: null,
      }),
    );
  });
});
