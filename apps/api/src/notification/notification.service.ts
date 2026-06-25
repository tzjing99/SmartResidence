import { resolveAnnouncementRecipientUserIds } from '@/announcement/announcement-audience';
import { isInQuietHours, parseUserPreferences } from '@/auth/user-preferences';
import type { AppEnv } from '@/config/env.schema';
import { PrismaService } from '@/prisma/prisma.service';
import { parseCondoVisitorSettings, walkInApprovalMinutes } from '@/visitor/visitor-settings';
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

/** Human-friendly notification titles for defect status transitions. */
const DEFECT_STATUS_BODY: Record<string, string> = {
  ACK: 'acknowledged',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
};

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
    if (!v?.hostUserId) return;
    await this.dispatch({
      userIds: [v.hostUserId],
      kind: NotificationKind.VISITOR_REQUEST,
      title: `Visitor pass for ${v.name}`,
      body: `Expected ${v.expectedAt.toLocaleString()} at ${v.unit?.identifier ?? 'your unit'}`,
      data: { visitorId: v.id, deeplink: `smartresidence://visitors/${v.id}` },
    });
  }

  /** Walk-in unit → notify unit owners/tenants for approval. */
  @OnEvent('visitor.walk_in_requested')
  async onWalkInRequested(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({
      where: { id: payload.visitorId },
      include: { unit: true, condo: true },
    });
    if (!v?.unitId) return;
    const minutes = walkInApprovalMinutes(parseCondoVisitorSettings(v.condo?.settings));
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
      body: `Guard requests approval for ${v.name} at ${v.unit?.identifier ?? 'your unit'}. Respond within ${minutes} minutes.`,
      data: { visitorId: v.id, deeplink: `smartresidence://visitors/${v.id}` },
    });
  }

  /** Guard admitted a walk-in on the spot → notify unit owners/tenants (transparency). */
  @OnEvent('visitor.walk_in_admitted')
  async onWalkInAdmitted(payload: { visitorId: string }) {
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
    const at = v.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await this.dispatch({
      userIds,
      kind: NotificationKind.VISITOR_CHECKED_IN,
      title: `Walk-in admitted: ${v.name}`,
      body: `The guard admitted ${v.name} to ${v.unit?.identifier ?? 'your unit'} at ${at}. No action needed — this is for your awareness.`,
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
      body: 'Owner approved the walk-in — acknowledge their entry at the gate (no pass scan).',
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

  /** Resident user ids for a unit (active owners + tenants). */
  private async unitResidentUserIds(unitId: string): Promise<string[]> {
    const [owners, tenants] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { unitId, status: 'ACTIVE' },
        select: { userId: true },
      }),
      this.prisma.tenancy.findMany({
        where: { unitId, status: 'ACTIVE' },
        select: { userId: true },
      }),
    ]);
    return [...new Set([...owners.map((o) => o.userId), ...tenants.map((t) => t.userId)])];
  }

  /** Visitor checked in at gate → push notify unit residents (and host if set). */
  @OnEvent('visitor.checked_in')
  async onVisitorCheckedIn(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({
      where: { id: payload.visitorId },
      include: {
        unit: { select: { identifier: true } },
        condo: { select: { timezone: true } },
        checkIns: { orderBy: { checkInAt: 'desc' }, take: 1 },
      },
    });
    if (!v) return;

    const userIds = new Set<string>();
    if (v.hostUserId) userIds.add(v.hostUserId);
    if (v.unitId) {
      for (const id of await this.unitResidentUserIds(v.unitId)) {
        userIds.add(id);
      }
    }
    if (userIds.size === 0) return;

    const tz = v.condo?.timezone ?? 'Asia/Kuala_Lumpur';
    const checkedInAt = v.checkIns[0]?.checkInAt ?? new Date();
    const timeLabel = checkedInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const unitPart = v.unit?.identifier ? ` · ${v.unit.identifier}` : '';

    await this.dispatch({
      userIds: [...userIds],
      kind: NotificationKind.VISITOR_CHECKED_IN,
      title: `${v.name} arrived at the gate`,
      body: `Checked in at ${timeLabel}${unitPart}.`,
      data: { visitorId: v.id, deeplink: `smartresidence://visitors/${v.id}` },
      timeZone: tz,
    });
  }

  @OnEvent('defect.created')
  async onDefectCreated(payload: { defectId: string }) {
    const d = await this.prisma.defect.findUnique({
      where: { id: payload.defectId },
      include: { unit: true },
    });
    if (!d?.unitId) return;
    const owners = await this.prisma.ownership.findMany({
      where: { unitId: d.unitId, status: 'ACTIVE' },
      select: { userId: true },
    });
    await this.dispatch({
      userIds: owners.map((o) => o.userId),
      kind: NotificationKind.DEFECT_UPDATE,
      title: 'New defect submitted',
      body: d.title,
      data: { defectId: d.id, deeplink: `smartresidence://defects/${d.id}` },
    });
  }

  /**
   * Handover report submitted → ONE summary notification to the unit's other
   * residents (never one push per line item). Management triages it on the web.
   */
  @OnEvent('defect.report.created')
  async onDefectReportCreated(payload: {
    reportId: string;
    condoId: string;
    itemCount: number;
    actorUserId?: string;
  }) {
    const report = await this.prisma.defectReport.findUnique({
      where: { id: payload.reportId },
      include: { unit: { select: { identifier: true } } },
    });
    if (!report?.unitId) return;
    const residents = await this.unitResidentUserIds(report.unitId);
    const recipients = residents.filter((id) => id !== payload.actorUserId);
    if (recipients.length === 0) return;
    await this.dispatch({
      userIds: recipients,
      kind: NotificationKind.DEFECT_UPDATE,
      title: 'Handover inspection submitted',
      body: `${payload.itemCount} item(s) logged for ${report.unit?.identifier ?? 'your unit'}.`,
      data: {
        reportId: report.id,
        deeplink: `smartresidence://defects/reports/${report.id}`,
      },
    });
  }

  /**
   * Bulk items resolved → one summary notification to the unit resident(s) asking
   * them to sign off. Excludes the actor so management doesn't notify themselves.
   */
  @OnEvent('defect.report.items.resolved')
  async onDefectReportItemsResolved(payload: {
    reportId: string;
    condoId: string;
    updatedCount: number;
    actorUserId?: string;
  }) {
    const report = await this.prisma.defectReport.findUnique({
      where: { id: payload.reportId },
      include: { unit: { select: { identifier: true } } },
    });
    if (!report?.unitId) return;
    const residents = await this.unitResidentUserIds(report.unitId);
    const recipients = residents.filter((id) => id !== payload.actorUserId);
    if (recipients.length === 0) return;
    await this.dispatch({
      userIds: recipients,
      kind: NotificationKind.DEFECT_UPDATE,
      title: 'Defects fixed — sign-off required',
      body: `${payload.updatedCount} defect(s) in your unit ${report.unit?.identifier ?? ''} have been marked fixed. Please review and sign off.`.trim(),
      data: {
        reportId: report.id,
        deeplink: `smartresidence://defects/reports/${report.id}`,
      },
    });
  }

  /** Defect status changed / (re)assigned → notify the resident + new assignee. */
  @OnEvent('defect.updated')
  async onDefectStatusChanged(payload: {
    defectId: string;
    statusFrom?: string;
    statusTo?: string;
    assigneeChanged?: boolean;
    assignedToUserId?: string;
    actorUserId?: string;
  }) {
    const d = await this.prisma.defect.findUnique({ where: { id: payload.defectId } });
    if (!d) return;
    const deeplink = `smartresidence://defects/${d.id}`;

    if (payload.statusTo && payload.statusTo !== payload.statusFrom) {
      const recipients = new Set<string>();
      if (d.raisedByUserId && d.raisedByUserId !== payload.actorUserId) {
        recipients.add(d.raisedByUserId);
      }
      if (recipients.size > 0) {
        await this.dispatch({
          userIds: [...recipients],
          kind: NotificationKind.DEFECT_UPDATE,
          title: `Defect ${DEFECT_STATUS_BODY[payload.statusTo] ?? payload.statusTo.toLowerCase()}`,
          body: d.title,
          data: { defectId: d.id, status: payload.statusTo, deeplink },
        });
      }
    }

    if (payload.assigneeChanged && payload.assignedToUserId) {
      await this.dispatch({
        userIds: [payload.assignedToUserId],
        kind: NotificationKind.DEFECT_UPDATE,
        title: 'Defect assigned to you',
        body: d.title,
        data: { defectId: d.id, deeplink },
      });
    }
  }

  /** New defect comment → notify the other party (resident ↔ assignee). */
  @OnEvent('defect.commented')
  async onDefectCommented(payload: {
    defectId: string;
    authorUserId: string;
    isInternal?: boolean;
  }) {
    if (payload.isInternal) return;
    const d = await this.prisma.defect.findUnique({ where: { id: payload.defectId } });
    if (!d) return;

    const recipients = new Set<string>();
    if (payload.authorUserId === d.raisedByUserId) {
      if (d.assignedToUserId) recipients.add(d.assignedToUserId);
    } else if (d.raisedByUserId) {
      recipients.add(d.raisedByUserId);
    }
    recipients.delete(payload.authorUserId);
    if (recipients.size === 0) return;

    await this.dispatch({
      userIds: [...recipients],
      kind: NotificationKind.DEFECT_UPDATE,
      title: 'New comment on your defect',
      body: d.title,
      data: { defectId: d.id, deeplink: `smartresidence://defects/${d.id}` },
    });
  }

  @OnEvent('invoice.issued')
  async onInvoiceIssued(payload: { invoiceId: string }) {
    const inv = await this.invoiceWithUnit(payload.invoiceId);
    if (!inv) return;
    const userIds = await this.unitResidentUserIds(inv.unitId);
    if (userIds.length === 0) return;
    await this.dispatch({
      userIds,
      kind: NotificationKind.INVOICE_ISSUED,
      title: `New invoice ${inv.number}`,
      body: `${this.formatMyr(inv.total)} due ${inv.dueDate.toLocaleDateString()} for ${inv.unit?.identifier ?? 'your unit'}.`,
      data: { invoiceId: inv.id, deeplink: `smartresidence://billing/${inv.id}` },
    });
  }

  @OnEvent('invoice.paid')
  async onInvoicePaid(payload: { invoiceId: string }) {
    const inv = await this.invoiceWithUnit(payload.invoiceId);
    if (!inv) return;
    const userIds = await this.unitResidentUserIds(inv.unitId);
    if (userIds.length === 0) return;
    await this.dispatch({
      userIds,
      kind: NotificationKind.INVOICE_PAID,
      title: `Payment received — ${inv.number}`,
      body: `We've received ${this.formatMyr(inv.total)} for ${inv.unit?.identifier ?? 'your unit'}. Thank you!`,
      data: { invoiceId: inv.id, deeplink: `smartresidence://billing/${inv.id}` },
    });
  }

  @OnEvent('invoice.due_soon')
  async onInvoiceDueSoon(payload: { invoiceId: string }) {
    const inv = await this.invoiceWithUnit(payload.invoiceId);
    if (!inv) return;
    const userIds = await this.unitResidentUserIds(inv.unitId);
    if (userIds.length === 0) return;
    await this.dispatch({
      userIds,
      kind: NotificationKind.INVOICE_DUE_SOON,
      title: `Invoice ${inv.number} due soon`,
      body: `${this.formatMyr(inv.total)} is due ${inv.dueDate.toLocaleDateString()}. Pay early to avoid late status.`,
      data: { invoiceId: inv.id, deeplink: `smartresidence://billing/${inv.id}` },
    });
  }

  @OnEvent('invoice.overdue')
  async onInvoiceOverdue(payload: { invoiceId: string }) {
    const inv = await this.invoiceWithUnit(payload.invoiceId);
    if (!inv) return;
    const userIds = await this.unitResidentUserIds(inv.unitId);
    if (userIds.length === 0) return;
    const outstanding = Number(inv.total) - Number(inv.amountPaid);
    await this.dispatch({
      userIds,
      kind: NotificationKind.INVOICE_DUE_SOON,
      title: `Invoice ${inv.number} is overdue`,
      body: `${this.formatMyr(outstanding)} was due ${inv.dueDate.toLocaleDateString()}. Please settle it as soon as possible.`,
      data: { invoiceId: inv.id, deeplink: `smartresidence://billing/${inv.id}` },
    });
  }

  private invoiceWithUnit(invoiceId: string) {
    return this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { unit: { select: { identifier: true } } },
    });
  }

  private formatMyr(amount: number | string | { toString(): string }): string {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(
      Number(amount),
    );
  }

  @OnEvent('announcement.published')
  async onAnnouncement(payload: { announcementId: string; condoId: string }) {
    const a = await this.prisma.announcement.findUnique({
      where: { id: payload.announcementId },
      include: {
        blocks: { select: { blockId: true } },
        units: { select: { unitId: true } },
      },
    });
    if (!a) return;
    const userIds = await resolveAnnouncementRecipientUserIds(this.prisma, a, payload.condoId);
    if (userIds.length === 0) return;
    await this.dispatch({
      userIds,
      kind: NotificationKind.ANNOUNCEMENT,
      title: a.title,
      body: a.body.slice(0, 140),
      data: { announcementId: a.id },
    });
  }
}
