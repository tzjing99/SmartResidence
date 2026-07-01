import { resolveAnnouncementRecipientUserIds } from '@/announcement/announcement-audience';
import { isInQuietHours, parseUserPreferences } from '@/auth/user-preferences';
import type { AppEnv } from '@/config/env.schema';
import { PrismaService } from '@/prisma/prisma.service';
import { parseCondoVisitorSettings, walkInApprovalMinutes } from '@/visitor/visitor-settings';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationKind, type Prisma, PushKind } from '@prisma/client';
import { resolveMalaysiaPhoneE164 } from '@smartresidence/shared-types';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { Resend } from 'resend';
import { isWhatsAppSupportedKind } from './providers/whatsapp-notification.provider';
import {
  WHATSAPP_NOTIFICATION_PROVIDER,
  type WhatsAppNotificationProvider,
} from './providers/whatsapp-notification.provider.interface';
import { WhatsAppConfigService } from './whatsapp-config.service';

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
    private readonly events: EventEmitter2,
    private readonly whatsappConfig: WhatsAppConfigService,
    @Inject(WHATSAPP_NOTIFICATION_PROVIDER)
    private readonly whatsappProvider: WhatsAppNotificationProvider,
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
    /** Condo scope for WhatsApp channel delivery. */
    condoId?: string;
  }): Promise<void> {
    if (opts.userIds.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: opts.userIds } },
      select: { id: true, email: true, phone: true, phoneVerifiedAt: true, preferences: true },
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
    for (const userId of opts.userIds) {
      this.events.emit('notification.created', {
        userId,
        kind: opts.kind,
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
      });
    }

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

    if (opts.condoId && isWhatsAppSupportedKind(opts.kind)) {
      const whatsapp = await this.whatsappConfig.resolveForDispatch(opts.condoId);
      if (whatsapp) {
        for (const userId of opts.userIds) {
          const user = userMap.get(userId);
          if (!user?.phone || !user.phoneVerifiedAt) continue;
          const prefs = parseUserPreferences(user.preferences);
          if (!prefs.whatsappNotifications) continue;
          const e164 = resolveMalaysiaPhoneE164(user.phone);
          if (!e164) continue;
          try {
            await this.whatsappProvider.send({
              phoneNumberId: whatsapp.phoneNumberId,
              credentials: whatsapp.credentials,
              toE164: e164,
              kind: opts.kind,
              title: opts.title,
              body: opts.body,
              data: opts.data,
            });
          } catch (err) {
            this.logger.warn(`WhatsApp to ${e164} failed: ${(err as Error).message}`);
          }
        }
      }
    }
  }

  /** Visitor created → notify host (themselves, useful for cross-device sync). */
  @OnEvent('visitor.created')
  async onVisitorCreated(payload: { visitorId: string }) {
    const v = await this.prisma.visitor.findUnique({
      where: { id: payload.visitorId },
      include: {
        host: { select: { id: true, name: true, phone: true } },
        unit: true,
      },
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
      condoId: v.condoId,
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
      data: {
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        deeplink: `smartresidence://billing/${inv.id}`,
      },
      condoId: inv.condoId,
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
      data: {
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        deeplink: `smartresidence://billing/${inv.id}`,
      },
      condoId: inv.condoId,
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

  /** Management (admin + staff) user ids for a condo. */
  private async condoManagementUserIds(condoId: string): Promise<string[]> {
    const rows = await this.prisma.roleAssignment.findMany({
      where: {
        condoId,
        revokedAt: null,
        roleId: { in: ['MANAGEMENT_ADMIN', 'MANAGEMENT_STAFF'] },
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  /** Resident user ids for document / announcement-style condo broadcasts. */
  private async condoResidentUserIds(
    condoId: string,
    opts: { ownersOnly?: boolean } = {},
  ): Promise<string[]> {
    const roles = opts.ownersOnly
      ? (['UNIT_OWNER'] as const)
      : (['UNIT_OWNER', 'TENANT', 'HOUSEHOLD_MEMBER'] as const);
    const rows = await this.prisma.roleAssignment.findMany({
      where: { condoId, revokedAt: null, roleId: { in: [...roles] } },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  /** Safety responders (management + guards) for a condo — the SOS audience. */
  private async condoSafetyResponderUserIds(condoId: string): Promise<string[]> {
    const rows = await this.prisma.roleAssignment.findMany({
      where: {
        condoId,
        revokedAt: null,
        roleId: { in: ['MANAGEMENT_ADMIN', 'MANAGEMENT_STAFF', 'SECURITY_GUARD'] },
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  // -- Guard safety: panic / SOS ---------------------------------------

  private sosWithRelations(sosId: string) {
    return this.prisma.sosAlert.findUnique({
      where: { id: sosId },
      include: {
        raisedBy: { select: { id: true, name: true } },
        unit: { select: { identifier: true } },
      },
    });
  }

  /** SOS raised → alert ALL management + guards in the condo immediately. */
  @OnEvent('sos.raised')
  async onSosRaised(payload: { sosId: string; condoId: string; raisedByUserId: string }) {
    const alert = await this.sosWithRelations(payload.sosId);
    if (!alert) return;
    const responders = await this.condoSafetyResponderUserIds(payload.condoId);
    const recipients = responders.filter((id) => id !== payload.raisedByUserId);
    if (recipients.length === 0) return;
    const where = alert.locationNote?.trim()
      ? alert.locationNote.trim()
      : (alert.unit?.identifier ?? 'location unknown');
    // Emergency alerts ignore quiet hours: no timeZone passed so push always fires.
    await this.dispatch({
      userIds: recipients,
      kind: NotificationKind.SYSTEM,
      title: `SOS: ${this.sosKindLabel(alert.kind)} emergency`,
      body: `${alert.raisedBy?.name ?? 'A resident'} needs help — ${where}. Tap to respond.`,
      data: { sosId: alert.id, kind: alert.kind, safety: true, deeplink: 'smartresidence://sos' },
    });
  }

  /** SOS acknowledged → reassure the raiser that help is on the way. */
  @OnEvent('sos.acknowledged')
  async onSosAcknowledged(payload: { sosId: string; raisedByUserId: string }) {
    const alert = await this.sosWithRelations(payload.sosId);
    if (!alert) return;
    await this.dispatch({
      userIds: [payload.raisedByUserId],
      kind: NotificationKind.SYSTEM,
      title: 'Help is on the way',
      body: 'Security has acknowledged your SOS and is responding.',
      data: { sosId: alert.id, deeplink: 'smartresidence://sos' },
    });
  }

  /** SOS resolved → let the raiser know it was closed. */
  @OnEvent('sos.resolved')
  async onSosResolved(payload: { sosId: string; raisedByUserId: string }) {
    const alert = await this.sosWithRelations(payload.sosId);
    if (!alert) return;
    await this.dispatch({
      userIds: [payload.raisedByUserId],
      kind: NotificationKind.SYSTEM,
      title: 'SOS resolved',
      body: 'Your SOS alert has been marked resolved by security. Stay safe.',
      data: { sosId: alert.id, deeplink: 'smartresidence://sos' },
    });
  }

  @OnEvent('patrol.overdue')
  async onPatrolOverdue(payload: {
    condoId: string;
    checkpointId: string;
    lastScanAt: string | null;
  }) {
    const checkpoint = await this.prisma.patrolCheckpoint.findUnique({
      where: { id: payload.checkpointId },
      select: { name: true, expectedIntervalMinutes: true },
    });
    if (!checkpoint) return;
    const managers = await this.condoManagementUserIds(payload.condoId);
    if (managers.length === 0) return;
    const lastSeen = payload.lastScanAt
      ? `last scanned ${new Date(payload.lastScanAt).toLocaleString('en-MY')}`
      : 'never scanned';
    await this.dispatch({
      userIds: managers,
      kind: NotificationKind.SYSTEM,
      title: 'Patrol checkpoint overdue',
      body: `${checkpoint.name} has not been scanned on schedule (${lastSeen}).`,
      data: { patrolCheckpointId: payload.checkpointId, deeplink: 'smartresidence://patrol' },
    });
  }

  /** Guard logged a parcel → notify unit residents to collect. */
  @OnEvent('parcel.received')
  async onParcelReceived(payload: { parcelId: string; condoId: string; unitId: string }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: payload.parcelId },
      include: {
        unit: { select: { identifier: true, block: { select: { name: true } } } },
      },
    });
    if (!parcel) return;
    const userIds = await this.unitResidentUserIds(payload.unitId);
    if (userIds.length === 0) return;
    const unitLabel = parcel.unit?.identifier ?? 'your unit';
    const carrier = parcel.carrier ? ` (${parcel.carrier})` : '';
    await this.dispatch({
      userIds,
      kind: NotificationKind.PARCEL_RECEIVED,
      title: 'Parcel received',
      body: `A parcel for ${parcel.recipientName}${carrier} is ready for collection at the lobby — ${unitLabel}.`,
      data: {
        parcelId: parcel.id,
        unitId: payload.unitId,
        recipientName: parcel.recipientName,
        unitLabel,
        deeplink: 'smartresidence://parcels',
      },
      condoId: payload.condoId,
    });
  }

  /** Uncollected parcel overdue → remind residents (and nudge management). */
  @OnEvent('parcel.overdue')
  async onParcelOverdue(payload: { parcelId: string; condoId: string; unitId: string }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: payload.parcelId },
      include: {
        unit: { select: { identifier: true } },
      },
    });
    if (!parcel) return;
    const residents = await this.unitResidentUserIds(payload.unitId);
    const unitLabel = parcel.unit?.identifier ?? 'your unit';
    if (residents.length > 0) {
      await this.dispatch({
        userIds: residents,
        kind: NotificationKind.PARCEL_OVERDUE,
        title: 'Parcel waiting for collection',
        body: `Your parcel for ${parcel.recipientName} at ${unitLabel} has not been collected. Please pick it up from the lobby.`,
        data: {
          parcelId: parcel.id,
          unitId: payload.unitId,
          deeplink: 'smartresidence://parcels',
        },
      });
    }
    const managers = await this.condoManagementUserIds(payload.condoId);
    if (managers.length > 0) {
      await this.dispatch({
        userIds: managers,
        kind: NotificationKind.PARCEL_OVERDUE,
        title: 'Uncollected parcel',
        body: `${parcel.recipientName} · ${unitLabel} — parcel overdue at lobby.`,
        data: {
          parcelId: parcel.id,
          deeplink: 'smartresidence://admin/parcels',
        },
      });
    }
  }

  private sosKindLabel(kind: string): string {
    switch (kind) {
      case 'MEDICAL':
        return 'Medical';
      case 'SECURITY':
        return 'Security';
      case 'FIRE':
        return 'Fire';
      default:
        return 'General';
    }
  }

  private async bookingWithFacility(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        facility: { select: { name: true } },
        unit: { select: { identifier: true } },
      },
    });
  }

  private bookingWhen(startAt: Date): string {
    return startAt.toLocaleString('en-MY', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** New PENDING booking → notify management to approve. */
  @OnEvent('booking.created')
  async onBookingCreated(payload: { bookingId: string; condoId: string; status: string }) {
    if (payload.status !== 'PENDING') return;
    const b = await this.bookingWithFacility(payload.bookingId);
    if (!b) return;
    const userIds = await this.condoManagementUserIds(payload.condoId);
    if (userIds.length === 0) return;
    await this.dispatch({
      userIds,
      kind: NotificationKind.SYSTEM,
      title: 'Facility booking needs approval',
      body: `${b.facility?.name ?? 'A facility'} — ${this.bookingWhen(b.startAt)}${b.unit?.identifier ? ` · ${b.unit.identifier}` : ''}`,
      data: { bookingId: b.id, deeplink: 'smartresidence://facilities' },
    });
  }

  /** Booking confirmed → notify the resident who booked. */
  @OnEvent('booking.confirmed')
  async onBookingConfirmed(payload: { bookingId: string; userId: string }) {
    const b = await this.bookingWithFacility(payload.bookingId);
    if (!b) return;
    await this.dispatch({
      userIds: [payload.userId],
      kind: NotificationKind.SYSTEM,
      title: 'Booking confirmed',
      body: `${b.facility?.name ?? 'Your facility'} is booked for ${this.bookingWhen(b.startAt)}.`,
      data: { bookingId: b.id, deeplink: 'smartresidence://facilities' },
    });
  }

  /** Booking rejected → notify the resident who booked. */
  @OnEvent('booking.rejected')
  async onBookingRejected(payload: { bookingId: string; userId: string }) {
    const b = await this.bookingWithFacility(payload.bookingId);
    if (!b) return;
    await this.dispatch({
      userIds: [payload.userId],
      kind: NotificationKind.SYSTEM,
      title: 'Booking not approved',
      body: `Your ${b.facility?.name ?? 'facility'} booking for ${this.bookingWhen(b.startAt)} was declined.`,
      data: { bookingId: b.id, deeplink: 'smartresidence://facilities' },
    });
  }

  /**
   * Booking cancelled → notify the resident when management cancelled, or
   * notify management (slot freed) when the resident cancelled their own.
   */
  @OnEvent('booking.cancelled')
  async onBookingCancelled(payload: {
    bookingId: string;
    condoId: string;
    userId: string;
    byManagement?: boolean;
    actorUserId?: string;
  }) {
    const b = await this.bookingWithFacility(payload.bookingId);
    if (!b) return;
    const when = this.bookingWhen(b.startAt);
    if (payload.byManagement) {
      await this.dispatch({
        userIds: [payload.userId],
        kind: NotificationKind.SYSTEM,
        title: 'Booking cancelled',
        body: `Management cancelled your ${b.facility?.name ?? 'facility'} booking for ${when}.`,
        data: { bookingId: b.id, deeplink: 'smartresidence://facilities' },
      });
      return;
    }
    const managers = await this.condoManagementUserIds(payload.condoId);
    const recipients = managers.filter((id) => id !== payload.actorUserId);
    if (recipients.length === 0) return;
    await this.dispatch({
      userIds: recipients,
      kind: NotificationKind.SYSTEM,
      title: 'Booking cancelled',
      body: `${b.facility?.name ?? 'A facility'} booking for ${when} was cancelled by the resident.`,
      data: { bookingId: b.id, deeplink: 'smartresidence://facilities' },
    });
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

  private async submissionWithTemplate(submissionId: string) {
    return this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: {
        template: { select: { title: true, kind: true } },
        unit: { select: { identifier: true } },
        user: { select: { name: true } },
      },
    });
  }

  /** Resident submitted a form → notify management to review. */
  @OnEvent('form.submitted')
  async onFormSubmitted(payload: {
    submissionId: string;
    condoId: string;
    userId: string;
    unitId: string;
  }) {
    const row = await this.submissionWithTemplate(payload.submissionId);
    if (!row) return;
    const managers = await this.condoManagementUserIds(payload.condoId);
    if (managers.length === 0) return;
    const unitLabel = row.unit?.identifier ?? 'a unit';
    const resident = row.user?.name ?? 'A resident';
    await this.dispatch({
      userIds: managers,
      kind: NotificationKind.FORM_SUBMITTED,
      title: 'Form awaiting review',
      body: `${row.template?.title ?? 'Form'} from ${resident} · ${unitLabel}`,
      data: {
        submissionId: row.id,
        deeplink: 'smartresidence://admin/forms',
      },
    });
  }

  /** Resident posted to lost & found → optionally notify management. */
  @OnEvent('lostfound.created')
  async onLostFoundCreated(payload: { postId: string; condoId: string; userId: string }) {
    const post = await this.prisma.lostFoundPost.findUnique({
      where: { id: payload.postId },
      include: {
        user: { select: { name: true } },
        unit: { select: { identifier: true } },
      },
    });
    if (!post) return;
    const managers = await this.condoManagementUserIds(payload.condoId);
    const recipients = managers.filter((id) => id !== payload.userId);
    if (recipients.length === 0) return;
    const kindLabel = post.kind === 'LOST' ? 'Lost item' : 'Found item';
    const unitLabel = post.unit?.identifier ?? 'a unit';
    const resident = post.user?.name ?? 'A resident';
    await this.dispatch({
      userIds: recipients,
      kind: NotificationKind.LOST_FOUND_POST,
      title: `New ${kindLabel.toLowerCase()} on the board`,
      body: `${post.title} — posted by ${resident} · ${unitLabel}`,
      data: {
        lostFoundPostId: post.id,
        deeplink: 'smartresidence://admin/lost-found',
      },
      condoId: payload.condoId,
    });
  }

  /** Management approved a form → notify the resident. */
  @OnEvent('form.approved')
  async onFormApproved(payload: { submissionId: string; userId: string }) {
    const row = await this.submissionWithTemplate(payload.submissionId);
    if (!row) return;
    await this.dispatch({
      userIds: [payload.userId],
      kind: NotificationKind.FORM_APPROVED,
      title: 'Form approved',
      body: `Your ${row.template?.title ?? 'form'} has been approved.`,
      data: {
        submissionId: row.id,
        deeplink: 'smartresidence://forms',
      },
    });
  }

  /** Management rejected a form → notify the resident with optional note. */
  @OnEvent('form.rejected')
  async onFormRejected(payload: {
    submissionId: string;
    userId: string;
    reviewNote?: string | null;
  }) {
    const row = await this.submissionWithTemplate(payload.submissionId);
    if (!row) return;
    const note = payload.reviewNote?.trim();
    await this.dispatch({
      userIds: [payload.userId],
      kind: NotificationKind.FORM_REJECTED,
      title: 'Form not approved',
      body: note
        ? `Your ${row.template?.title ?? 'form'} was declined: ${note}`
        : `Your ${row.template?.title ?? 'form'} was declined.`,
      data: {
        submissionId: row.id,
        deeplink: 'smartresidence://forms',
      },
    });
  }

  /** New condo document published → notify residents who can access the folder. */
  @OnEvent('document.version.published')
  async onDocumentPublished(payload: {
    documentId: string;
    versionId: string;
    condoId: string;
    folderAudience: string;
    title: string;
  }) {
    if (payload.folderAudience === 'MANAGEMENT') return;

    const userIds = await this.condoResidentUserIds(payload.condoId, {
      ownersOnly: payload.folderAudience === 'OWNERS',
    });
    if (userIds.length === 0) return;

    await this.dispatch({
      userIds,
      kind: NotificationKind.DOCUMENT_PUBLISHED,
      title: 'New document published',
      body: `${payload.title} is now available in the document library.`,
      data: {
        documentId: payload.documentId,
        versionId: payload.versionId,
        deeplink: 'smartresidence://documents',
      },
    });
  }

  /** AGM/EGM notice published → notify all unit owners. */
  @OnEvent('governance.notice.published')
  async onMeetingNoticePublished(payload: { meetingId: string; condoId: string }) {
    const meeting = await this.prisma.generalMeeting.findUnique({
      where: { id: payload.meetingId },
    });
    if (!meeting) return;

    const userIds = await this.condoResidentUserIds(payload.condoId, { ownersOnly: true });
    if (userIds.length === 0) return;

    await this.dispatch({
      userIds,
      kind: NotificationKind.MEETING_NOTICE_PUBLISHED,
      title: `${meeting.kind} notice: ${meeting.title}`,
      body: meeting.noticeBody.slice(0, 140),
      data: {
        meetingId: meeting.id,
        deeplink: 'smartresidence://governance',
      },
      condoId: payload.condoId,
    });
  }

  /** Owner submitted a proxy → notify management. */
  @OnEvent('governance.proxy.submitted')
  async onProxySubmitted(payload: {
    proxyId: string;
    meetingId: string;
    condoId: string;
    ownerUserId: string;
    unitId: string;
  }) {
    const [meeting, unit] = await Promise.all([
      this.prisma.generalMeeting.findUnique({ where: { id: payload.meetingId } }),
      this.prisma.unit.findUnique({
        where: { id: payload.unitId },
        select: { identifier: true },
      }),
    ]);
    if (!meeting) return;

    const managers = await this.condoManagementUserIds(payload.condoId);
    if (managers.length === 0) return;

    await this.dispatch({
      userIds: managers,
      kind: NotificationKind.PROXY_RECEIVED,
      title: 'Proxy form received',
      body: `Unit ${unit?.identifier ?? 'unknown'} submitted a proxy for ${meeting.title}.`,
      data: {
        proxyId: payload.proxyId,
        meetingId: payload.meetingId,
        deeplink: 'smartresidence://admin/governance',
      },
      condoId: payload.condoId,
    });
  }

  /** Resolution voting opened → notify all unit owners. */
  @OnEvent('governance.resolution.opened')
  async onResolutionOpened(payload: {
    resolutionId: string;
    meetingId: string;
    condoId: string;
    pollId: string | null;
  }) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: payload.resolutionId },
      include: { meeting: { select: { title: true } } },
    });
    if (!resolution) return;

    const userIds = await this.condoResidentUserIds(payload.condoId, { ownersOnly: true });
    if (userIds.length === 0) return;

    await this.dispatch({
      userIds,
      kind: NotificationKind.RESOLUTION_OPEN,
      title: 'Resolution open for voting',
      body: `${resolution.title} — ${resolution.meeting.title}`,
      data: {
        resolutionId: resolution.id,
        meetingId: payload.meetingId,
        pollId: payload.pollId,
        deeplink: 'smartresidence://governance',
      },
      condoId: payload.condoId,
    });
  }
}
