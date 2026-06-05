import type { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationKind, type Prisma, PushKind } from '@prisma/client';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, opts: { limit: number; offset: number; unreadOnly?: boolean }) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, ...opts };
  }

  async markRead(userId: string, ids: string[]) {
    await this.prisma.notification.updateMany({
      where: { userId, id: { in: ids } },
      data: { readAt: new Date() },
    });
  }

  async registerPushToken(opts: {
    userId: string;
    kind: PushKind;
    token: string;
    deviceInfo?: Record<string, unknown>;
  }) {
    return this.prisma.pushSubscription.upsert({
      where: { kind_token: { kind: opts.kind, token: opts.token } },
      update: {
        userId: opts.userId,
        deviceInfo: (opts.deviceInfo ?? {}) as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
      },
      create: {
        userId: opts.userId,
        kind: opts.kind,
        token: opts.token,
        deviceInfo: (opts.deviceInfo ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async dispatch(opts: {
    userIds: string[];
    kind: NotificationKind;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    if (opts.userIds.length === 0) return;

    await this.prisma.notification.createMany({
      data: opts.userIds.map((userId) => ({
        userId,
        kind: opts.kind,
        title: opts.title,
        body: opts.body,
        data: (opts.data ?? {}) as Prisma.InputJsonValue,
      })),
    });

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: opts.userIds }, revokedAt: null },
    });
    const expoMessages: ExpoPushMessage[] = [];
    for (const s of subs) {
      if (s.kind === PushKind.EXPO && Expo.isExpoPushToken(s.token)) {
        expoMessages.push({
          to: s.token,
          title: opts.title,
          body: opts.body,
          data: opts.data,
          sound: 'default',
          priority: 'high',
        });
      }
    }
    if (expoMessages.length === 0) return;

    try {
      const chunks = this.expo.chunkPushNotifications(expoMessages);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch (err) {
      this.logger.warn(`Expo push failed: ${(err as Error).message}`);
    }
  }

  /** Visitor created → notify host (themselves, useful for cross-device sync). */
  @OnEvent('visitor.created')
  async onVisitorCreated(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({
      where: { id: payload.visitorId },
      include: { host: true, unit: true },
    });
    if (!v) return;
    await this.dispatch({
      userIds: [v.hostUserId],
      kind: NotificationKind.VISITOR_REQUEST,
      title: `Visitor pass for ${v.name}`,
      body: `Expected ${v.expectedAt.toLocaleString()} at ${v.unit.identifier}`,
      data: { visitorId: v.id, deeplink: `smartresidence://visitors/${v.id}` },
    });
  }

  /** Visitor checked in → notify host. */
  @OnEvent('visitor.checked_in')
  async onVisitorCheckedIn(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({ where: { id: payload.visitorId } });
    if (!v) return;
    await this.dispatch({
      userIds: [v.hostUserId],
      kind: NotificationKind.VISITOR_CHECKED_IN,
      title: `${v.name} arrived`,
      body: 'Your visitor was checked in by the guard.',
      data: { visitorId: v.id },
    });
  }

  @OnEvent('defect.created')
  async onDefectCreated(payload: { defectId: string }) {
    const d = await this.prisma.defect.findUnique({
      where: { id: payload.defectId },
      include: { unit: true },
    });
    if (!d) return;
    const owners = await this.prisma.ownership.findMany({
      where: { unitId: d.unitId ?? '', status: 'ACTIVE' },
    });
    await this.dispatch({
      userIds: owners.map((o) => o.userId),
      kind: NotificationKind.DEFECT_UPDATE,
      title: 'New defect submitted',
      body: d.title,
      data: { defectId: d.id },
    });
  }

  @OnEvent('announcement.published')
  async onAnnouncement(payload: { announcementId: string; condoId: string }) {
    const a = await this.prisma.announcement.findUnique({ where: { id: payload.announcementId } });
    if (!a) return;
    const audience = await this.prisma.roleAssignment.findMany({
      where: { condoId: payload.condoId, revokedAt: null },
      select: { userId: true },
    });
    await this.dispatch({
      userIds: Array.from(new Set(audience.map((r) => r.userId))),
      kind: NotificationKind.ANNOUNCEMENT,
      title: a.title,
      body: a.body.slice(0, 140),
      data: { announcementId: a.id },
    });
  }
}
