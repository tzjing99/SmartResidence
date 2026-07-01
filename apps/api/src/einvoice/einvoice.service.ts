import { SecretEncryptionService } from '@/billing/crypto/secret-encryption.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/queue/queue.service';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditAction, type EInvoice, type Prisma, RoleId } from '@prisma/client';
import {
  type EInvoiceConfigView,
  type EInvoiceDocument,
  type EInvoiceView,
  formatCompactUnitLabel,
} from '@smartresidence/shared-types';
import { type EInvoiceBuilderBuyer, buildEInvoiceDocument } from './document-builder';
import type { UpdateEInvoiceConfigDto } from './dto/einvoice.dto';
import {
  hasEInvoiceSecret,
  mergeEInvoiceConfig,
  parseEInvoiceConfig,
  readEInvoiceSecret,
  writeEInvoiceSecret,
} from './einvoice-settings';
import { DelegatingMyInvoisProvider } from './providers/delegating-myinvois.provider';
import {
  MYINVOIS_PROVIDER,
  type MyInvoisCredentials,
  type MyInvoisProvider,
} from './providers/myinvois-provider.interface';

@Injectable()
export class EInvoiceService {
  private readonly logger = new Logger(EInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: SecretEncryptionService,
    @Inject(MYINVOIS_PROVIDER) private readonly provider: MyInvoisProvider,
    @Optional() private readonly queues?: QueueService,
  ) {}

  // -- Config ---------------------------------------------------------

  async getConfig(actor: AuthenticatedUser, condoId: string): Promise<EInvoiceConfigView> {
    this.assertCondoManagement(actor, condoId, false);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    return {
      ...parseEInvoiceConfig(condo.settings),
      secretConfigured: hasEInvoiceSecret(condo.settings),
      updatedAt: condo.updatedAt.toISOString(),
    };
  }

  async updateConfig(
    actor: AuthenticatedUser,
    condoId: string,
    dto: UpdateEInvoiceConfigDto,
  ): Promise<EInvoiceConfigView> {
    this.assertCondoManagement(actor, condoId, true);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const { apiClientId, apiClientSecret, ...configPatch } = dto;
    let settings = mergeEInvoiceConfig(condo.settings, configPatch);

    // Store the LHDN API credentials encrypted; merge with any existing values
    // so a partial update (e.g. rotating just the secret) keeps the other field.
    if (apiClientId !== undefined || apiClientSecret !== undefined) {
      const existing = this.resolveCredentials(condo.settings);
      const credentials: MyInvoisCredentials = {
        clientId: apiClientId ?? existing?.clientId,
        clientSecret: apiClientSecret ?? existing?.clientSecret,
      };
      const enc = this.encryption.encryptJson(credentials as Record<string, unknown>);
      settings = writeEInvoiceSecret(settings, {
        ciphertext: enc.ciphertext.toString('base64'),
        iv: enc.iv.toString('base64'),
        authTag: enc.authTag.toString('base64'),
        keyVersion: enc.keyVersion,
      });
    }

    const updated = await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: settings as Prisma.InputJsonValue },
    });
    return {
      ...parseEInvoiceConfig(updated.settings),
      secretConfigured: hasEInvoiceSecret(updated.settings),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /** Decrypt the stored LHDN API credentials, if any (never leaves the server). */
  private resolveCredentials(settings: unknown): MyInvoisCredentials | null {
    const envelope = readEInvoiceSecret(settings);
    if (!envelope) return null;
    try {
      return this.encryption.decryptJson<MyInvoisCredentials>({
        ciphertext: Buffer.from(envelope.ciphertext, 'base64'),
        iv: Buffer.from(envelope.iv, 'base64'),
        authTag: Buffer.from(envelope.authTag, 'base64'),
      });
    } catch (err) {
      this.logger.warn(`Failed to decrypt LHDN credentials: ${(err as Error).message}`);
      return null;
    }
  }

  // -- E-invoice per invoice -----------------------------------------

  async getForInvoice(actor: AuthenticatedUser, invoiceId: string): Promise<EInvoiceView | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { condoId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    this.assertCondoManagement(actor, invoice.condoId, false);
    const row = await this.prisma.eInvoice.findUnique({ where: { invoiceId } });
    return row ? this.toView(row, true) : null;
  }

  async submit(actor: AuthenticatedUser, invoiceId: string): Promise<EInvoiceView> {
    const invoice = await this.loadInvoiceForSubmit(invoiceId);
    this.assertCondoManagement(actor, invoice.condoId, true);

    const config = parseEInvoiceConfig(invoice.condo.settings);
    if (!config.enabled) {
      throw new BadRequestException('E-invoicing is not enabled for this condo');
    }

    const document = this.buildDocument(invoice, config);
    const credentials = this.resolveCredentials(invoice.condo.settings) ?? undefined;

    const existing = await this.prisma.eInvoice.findUnique({ where: { invoiceId } });
    if (existing?.status === 'VALID') {
      throw new BadRequestException('This invoice already has a validated e-invoice');
    }

    const providerId = this.resolveProviderId(config.environment, credentials);
    const result = await this.provider.submit({
      document,
      environment: config.environment,
      credentials,
    });

    const now = new Date();
    const data = {
      condoId: invoice.condoId,
      status: result.status,
      environment: config.environment,
      lhdnUuid: result.uuid,
      lhdnLongId: result.longId ?? null,
      submissionUid: result.submissionUid ?? null,
      qrPayload: result.qrPayload ?? null,
      validationUrl: result.validationUrl ?? null,
      documentJson: document as unknown as Prisma.InputJsonValue,
      errorMessage: result.error ?? null,
      submittedAt: now,
      validatedAt: result.status === 'VALID' ? now : null,
    };

    const row = await this.prisma.eInvoice.upsert({
      where: { invoiceId },
      create: { invoiceId, ...data },
      update: data,
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: invoice.condoId,
        unitId: invoice.unitId,
        actorUserId: actor.id,
        action: AuditAction.CREATE,
        resourceType: 'EInvoice',
        resourceId: row.id,
        metadata: {
          invoiceNumber: invoice.number,
          status: result.status,
          lhdnUuid: result.uuid,
          provider: providerId,
          ...(result.error ? { error: result.error } : {}),
        },
      },
    });

    return this.toView(row, true);
  }

  async cancel(
    actor: AuthenticatedUser,
    invoiceId: string,
    reason?: string,
  ): Promise<EInvoiceView> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { condoId: true, unitId: true, condo: { select: { settings: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    this.assertCondoManagement(actor, invoice.condoId, true);

    const row = await this.prisma.eInvoice.findUnique({ where: { invoiceId } });
    if (!row) throw new NotFoundException('No e-invoice for this invoice');
    if (!row.lhdnUuid) throw new BadRequestException('E-invoice has no LHDN identifier to cancel');
    if (row.status === 'CANCELLED') return this.toView(row, true);

    const credentials = this.resolveCredentials(invoice.condo.settings) ?? undefined;
    const result = await this.provider.cancel(
      row.lhdnUuid,
      reason ?? '',
      row.environment,
      credentials,
    );
    const updated = await this.prisma.eInvoice.update({
      where: { invoiceId },
      data: {
        status: result.status,
        cancelledAt: new Date(),
        errorMessage: result.error ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: invoice.condoId,
        unitId: invoice.unitId,
        actorUserId: actor.id,
        action: AuditAction.UPDATE,
        resourceType: 'EInvoice',
        resourceId: updated.id,
        metadata: { cancelled: true, reason: reason ?? null, lhdnUuid: row.lhdnUuid },
      },
    });

    return this.toView(updated, true);
  }

  // -- Auto-submission on issue --------------------------------------

  /**
   * When e-invoicing is enabled for the condo, create a NOT_SUBMITTED e-invoice
   * (or submit it when auto-submit is on) as the invoice is issued. Idempotent:
   * an existing e-invoice row is left untouched. Failures are swallowed so they
   * never block invoice issuance — management can retry from the invoices page.
   */
  @OnEvent('invoice.issued')
  async onInvoiceIssued(payload: { invoiceId: string }): Promise<void> {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: payload.invoiceId },
        select: { id: true, condoId: true, condo: { select: { settings: true } } },
      });
      if (!invoice) return;
      const config = parseEInvoiceConfig(invoice.condo.settings);
      if (!config.enabled) return;

      const existing = await this.prisma.eInvoice.findUnique({
        where: { invoiceId: invoice.id },
        select: { id: true },
      });
      if (existing) return;

      if (config.autoSubmitOnIssue) {
        await (this.queues?.enqueueEInvoiceSubmit({ invoiceId: invoice.id }) ??
          this.processSubmitJob({ invoiceId: invoice.id }));
      } else {
        await this.prisma.eInvoice.create({
          data: {
            invoiceId: invoice.id,
            condoId: invoice.condoId,
            status: 'NOT_SUBMITTED',
            environment: config.environment,
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Auto e-invoice for invoice ${payload.invoiceId} failed: ${(err as Error).message}`,
      );
    }
  }

  /** LHDN submission worker — keeps invoice issuance and payment webhooks fast. */
  async processSubmitJob(payload: { invoiceId: string }): Promise<void> {
    try {
      const invoice = await this.loadInvoiceForSubmit(payload.invoiceId);
      const config = parseEInvoiceConfig(invoice.condo.settings);
      const existing = await this.prisma.eInvoice.findUnique({
        where: { invoiceId: payload.invoiceId },
        select: { id: true, status: true },
      });
      if (existing?.status === 'VALID') return;

      const document = this.buildDocument(invoice, config);
      const credentials = this.resolveCredentials(invoice.condo.settings) ?? undefined;
      const result = await this.provider.submit({
        document,
        environment: config.environment,
        credentials,
      });
      const now = new Date();
      const data = {
        condoId: invoice.condoId,
        status: result.status,
        environment: config.environment,
        lhdnUuid: result.uuid,
        lhdnLongId: result.longId ?? null,
        submissionUid: result.submissionUid ?? null,
        qrPayload: result.qrPayload ?? null,
        validationUrl: result.validationUrl ?? null,
        documentJson: document as unknown as Prisma.InputJsonValue,
        errorMessage: result.error ?? null,
        submittedAt: now,
        validatedAt: result.status === 'VALID' ? now : null,
      };

      await this.prisma.eInvoice.upsert({
        where: { invoiceId: payload.invoiceId },
        create: { invoiceId: payload.invoiceId, ...data },
        update: data,
      });
    } catch (err) {
      this.logger.warn(
        `E-invoice submit job for ${payload.invoiceId} failed: ${(err as Error).message}`,
      );
    }
  }

  // -- Helpers --------------------------------------------------------

  private async loadInvoiceForSubmit(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        condo: true,
        unit: {
          include: {
            block: true,
            ownerships: {
              where: { status: 'ACTIVE', isPrimary: true },
              include: { user: { select: { name: true, email: true, phone: true } } },
              take: 1,
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private buildDocument(
    invoice: Awaited<ReturnType<EInvoiceService['loadInvoiceForSubmit']>>,
    config: ReturnType<typeof parseEInvoiceConfig>,
  ): EInvoiceDocument {
    const owner = invoice.unit.ownerships[0]?.user ?? null;
    const buyer: EInvoiceBuilderBuyer = {
      name: owner?.name || `Unit ${formatCompactUnitLabel(invoice.unit)}`,
      email: owner?.email ?? undefined,
      phone: owner?.phone ?? undefined,
    };
    return buildEInvoiceDocument({
      invoiceNumber: invoice.number,
      issuedAt: invoice.issuedAt ?? invoice.createdAt,
      currencyCode: invoice.currencyCode,
      config,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        amount: Number(l.amount),
      })),
      buyer,
    });
  }

  private toView(row: EInvoice, includeDocument = false): EInvoiceView {
    return {
      id: row.id,
      invoiceId: row.invoiceId,
      condoId: row.condoId,
      status: row.status,
      environment: row.environment,
      lhdnUuid: row.lhdnUuid,
      lhdnLongId: row.lhdnLongId,
      submissionUid: row.submissionUid,
      qrPayload: row.qrPayload,
      validationUrl: row.validationUrl,
      errorMessage: row.errorMessage,
      validatedAt: row.validatedAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(includeDocument
        ? { document: (row.documentJson as unknown as EInvoiceDocument) ?? null }
        : {}),
    };
  }

  /** Provider id actually used for a condo (sandbox vs production). */
  private resolveProviderId(environment: string, credentials?: MyInvoisCredentials): string {
    if (this.provider instanceof DelegatingMyInvoisProvider) {
      return this.provider.resolveProviderId(environment, credentials);
    }
    return this.provider.id;
  }

  private assertCondoManagement(
    user: AuthenticatedUser,
    condoId: string,
    adminOnly: boolean,
  ): void {
    const ok = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === condoId) ||
        (!adminOnly && r.roleId === RoleId.MANAGEMENT_STAFF && r.condoId === condoId),
    );
    if (!ok) throw new ForbiddenException('You cannot manage e-invoicing for this condo');
  }
}
