import { isInQuietHours, parseUserPreferences } from '@/auth/user-preferences';
import type { AppEnv } from '@/config/env.schema';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationKind, type Prisma, PushKind } from '@prisma/client';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { Resend } from 'resend';

const THREAD_KINDS: NotificationKind[] = [
  NotificationKind.THREAD_MESSAGE,
  NotificationKind.THREAD_ASSIGNED,
  NotificationKind.THREAD_STATUS,
  NotificationKind.THREAD_SLA_ESCALATION,
];

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly expo = new Expo();
  private readonly resend: Resend | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppEnv, true>,
  ) {
    const key = config.get('RESEND_API_KEY', { infer: true });
    this.resend = key ? new Resend(key) : null;
  }

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
    /** Condo timezone for quiet-hours evaluation (E5). */
    timeZone?: string;
  }): Promise<void> {
    if (opts.userIds.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: opts.userIds } },
      select: { id: true, email: true, preferences: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    await this.prisma.notification.createMany({
      data: opts.userIds.map((userId) => ({
        userId,
        kind: opts.kind,
        title: opts.title,
        body: opts.body,
        data: (opts.data ?? {}) as Prisma.InputJsonValue,
      })),
    });

    const pushUserIds: string[] = [];
    const emailTargets: Array<{ email: string; userId: string }> = [];

    for (const userId of opts.userIds) {
      const user = userMap.get(userId);
      if (!user) continue;
      const prefs = parseUserPreferences(user.preferences);
      if (!isInQuietHours(prefs, new Date(), opts.timeZone)) {
        pushUserIds.push(userId);
      }
      if (THREAD_KINDS.includes(opts.kind) && prefs.emailNotifications && user.email) {
        emailTargets.push({ email: user.email, userId });
      }
    }

    if (pushUserIds.length > 0) {
      const subs = await this.prisma.pushSubscription.findMany({
        where: { userId: { in: pushUserIds }, revokedAt: null },
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
      if (expoMessages.length > 0) {
        try {
          const chunks = this.expo.chunkPushNotifications(expoMessages);
          for (const chunk of chunks) {
            await this.expo.sendPushNotificationsAsync(chunk);
          }
        } catch (err) {
          this.logger.warn(`Expo push failed: ${(err as Error).message}`);
        }
      }
    }

    for (const target of emailTargets) {
      if (this.resend) {
        try {
          await this.resend.emails.send({
            from: 'SmartResidence <notifications@smartresidence.local>',
            to: target.email,
            subject: opts.title,
            text: opts.body,
          });
        } catch (err) {
          this.logger.warn(`Email to ${target.email} failed: ${(err as Error).message}`);
        }
      } else {
        this.logger.debug(
          `[email opt-in] ${target.email}: ${opts.title} — ${opts.body.slice(0, 80)}`,
        );
      }
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

  /** Walk-in unit → notify unit owners/tenants for approval. */
  @OnEvent('visitor.walk_in_requested')
  async onWalkInRequested(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({
      where: { id: payload.visitorId },
      include: { unit: true },
    });
    if (!v?.unitId) return;
    const [owners, tenants] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { unitId: v.unitId, status: 'ACTIVE' },
        select: { userId: true },
      }),
      this.prisma.tenancy.findMany({
        where: { unitId: v.unitId, status: 'ACTIVE' },
        select: { userId: true },
      }),
    ]);
    const userIds = [...new Set([...owners.map((o) => o.userId), ...tenants.map((t) => t.userId)])];
    if (userIds.length === 0) return;
    await this.dispatch({
      userIds,
      kind: NotificationKind.VISITOR_REQUEST,
      title: `Walk-in: ${v.name}`,
      body: `Guard requests approval for ${v.name} at ${v.unit?.identifier ?? 'your unit'}. Respond within 15 minutes.`,
      data: { visitorId: v.id, deeplink: `smartresidence://visitors/${v.id}` },
    });
  }

  @OnEvent('visitor.approved')
  async onVisitorApproved(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({ where: { id: payload.visitorId } });
    if (!v) return;
    const guardId = (v.metadata as { createdByGuardId?: string })?.createdByGuardId;
    const userIds = guardId ? [guardId] : [];
    if (userIds.length === 0) return;
    await this.dispatch({
      userIds,
      kind: NotificationKind.VISITOR_REQUEST,
      title: `${v.name} approved`,
      body: 'Owner approved the walk-in — you may check them in.',
      data: { visitorId: v.id },
    });
  }

  @OnEvent('visitor.rejected')
  async onVisitorRejected(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({ where: { id: payload.visitorId } });
    if (!v) return;
    const guardId = (v.metadata as { createdByGuardId?: string })?.createdByGuardId;
    if (!guardId) return;
    await this.dispatch({
      userIds: [guardId],
      kind: NotificationKind.VISITOR_REQUEST,
      title: `${v.name} rejected`,
      body: 'Owner rejected the walk-in — inform the visitor.',
      data: { visitorId: v.id },
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
