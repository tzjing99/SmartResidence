import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  FormSubmissionStatus,
  FormTemplateKind,
  type Prisma,
  RoleId,
} from '@prisma/client';
import {
  DEFAULT_FORM_TEMPLATES,
  type FormFields,
  type FormPermitVerify,
  isPermitFormKind,
} from '@smartresidence/shared-types';
import * as QRCode from 'qrcode';
import {
  buildQrPayload,
  generateAccessCode,
  isVisitorId,
  normalizePassInput,
  parseQrPayload,
} from '../visitor/access-code';
import type {
  CreateFormSubmissionDto,
  CreateFormTemplateDto,
  ListFormSubmissionsDto,
  RejectFormSubmissionDto,
  UpdateFormSubmissionDto,
  UpdateFormTemplateDto,
} from './dto/forms.dto';
import { buildPermitPdf } from './permit-pdf';

const submissionInclude = {
  template: { select: { id: true, kind: true, title: true, fields: true, active: true } },
  unit: { select: { id: true, identifier: true } },
  user: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.FormSubmissionInclude;

type SubmissionWithRelations = Prisma.FormSubmissionGetPayload<{
  include: typeof submissionInclude;
}>;

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async listTemplates(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { includeInactive?: boolean; limit: number; offset: number },
  ) {
    this.assertCondoAccess(actor, condoId);
    await this.ensureDefaultTemplates(condoId);

    const manage = this.isManagement(actor, condoId);
    const where: Prisma.FormTemplateWhereInput = {
      condoId,
      ...(manage && opts.includeInactive ? {} : { active: true }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.formTemplate.findMany({
        where,
        orderBy: [{ position: 'asc' }, { title: 'asc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.formTemplate.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getTemplate(actor: AuthenticatedUser, id: string) {
    const row = await this.prisma.formTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Form template not found');
    this.assertCondoAccess(actor, row.condoId);
    if (!row.active && !this.isManagement(actor, row.condoId)) {
      throw new NotFoundException('Form template not found');
    }
    return row;
  }

  async createTemplate(actor: AuthenticatedUser, dto: CreateFormTemplateDto) {
    this.assertManagement(actor, dto.condoId);
    this.validateFields(dto.fields);

    const created = await this.prisma.formTemplate.create({
      data: {
        condoId: dto.condoId,
        kind: dto.kind,
        title: dto.title.trim(),
        fields: dto.fields as unknown as Prisma.InputJsonValue,
        active: dto.active ?? true,
        position: dto.position ?? 0,
      },
    });

    await this.audit(actor, dto.condoId, null, AuditAction.CREATE, 'FormTemplate', created.id, {
      kind: created.kind,
    });
    return created;
  }

  async updateTemplate(actor: AuthenticatedUser, id: string, dto: UpdateFormTemplateDto) {
    const existing = await this.prisma.formTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form template not found');
    this.assertManagement(actor, existing.condoId);
    if (dto.fields) this.validateFields(dto.fields);

    const updated = await this.prisma.formTemplate.update({
      where: { id },
      data: {
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.fields !== undefined
          ? { fields: dto.fields as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });

    await this.audit(actor, existing.condoId, null, AuditAction.UPDATE, 'FormTemplate', id, {
      kind: updated.kind,
    });
    return updated;
  }

  async deleteTemplate(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.formTemplate.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!existing) throw new NotFoundException('Form template not found');
    this.assertManagement(actor, existing.condoId);

    if (existing._count.submissions > 0) {
      const updated = await this.prisma.formTemplate.update({
        where: { id },
        data: { active: false },
      });
      await this.audit(actor, existing.condoId, null, AuditAction.UPDATE, 'FormTemplate', id, {
        deactivated: true,
      });
      return updated;
    }

    await this.prisma.formTemplate.delete({ where: { id } });
    await this.audit(actor, existing.condoId, null, AuditAction.DELETE, 'FormTemplate', id, {});
    return { ok: true };
  }

  async listSubmissionsForCondo(
    actor: AuthenticatedUser,
    condoId: string,
    opts: ListFormSubmissionsDto,
  ) {
    this.assertManagement(actor, condoId);
    const where: Prisma.FormSubmissionWhereInput = {
      condoId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.templateId ? { templateId: opts.templateId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.formSubmission.findMany({
        where,
        include: submissionInclude,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async listMine(actor: AuthenticatedUser, opts: { limit: number; offset: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.formSubmission.findMany({
        where: { userId: actor.id },
        include: submissionInclude,
        orderBy: { updatedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.formSubmission.count({ where: { userId: actor.id } }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getSubmission(actor: AuthenticatedUser, id: string) {
    const row = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: submissionInclude,
    });
    if (!row) throw new NotFoundException('Form submission not found');
    const owns = row.userId === actor.id;
    if (!owns && !this.isManagement(actor, row.condoId)) {
      throw new ForbiddenException('You cannot view this submission');
    }
    return row;
  }

  async createSubmission(actor: AuthenticatedUser, dto: CreateFormSubmissionDto) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template || !template.active) throw new NotFoundException('Form template not found');
    this.assertCondoAccess(actor, template.condoId);
    await this.assertActsForUnit(actor, dto.unitId, template.condoId);

    const fields = this.parseFields(template.fields);
    const answers = dto.answers ?? {};
    const submit = dto.submit === true;

    if (submit) this.validateAnswers(fields, answers);

    const status = submit ? FormSubmissionStatus.SUBMITTED : FormSubmissionStatus.DRAFT;
    const created = await this.prisma.formSubmission.create({
      data: {
        templateId: template.id,
        condoId: template.condoId,
        unitId: dto.unitId,
        userId: actor.id,
        status,
        answers: answers as Prisma.InputJsonValue,
        submittedAt: submit ? new Date() : null,
      },
      include: submissionInclude,
    });

    await this.audit(
      actor,
      template.condoId,
      dto.unitId,
      AuditAction.CREATE,
      'FormSubmission',
      created.id,
      { status, templateKind: template.kind },
    );

    this.emitUpdate(created);
    if (submit) {
      this.events.emit('form.submitted', {
        submissionId: created.id,
        condoId: template.condoId,
        userId: actor.id,
        unitId: dto.unitId,
      });
    }
    return created;
  }

  async updateSubmission(actor: AuthenticatedUser, id: string, dto: UpdateFormSubmissionDto) {
    const existing = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!existing) throw new NotFoundException('Form submission not found');
    if (existing.userId !== actor.id) {
      throw new ForbiddenException('You can only edit your own submissions');
    }
    if (existing.status !== FormSubmissionStatus.DRAFT) {
      throw new BadRequestException('Only draft submissions can be edited');
    }

    const answers = dto.answers ?? (existing.answers as Record<string, unknown>);
    const submit = dto.submit === true;
    const fields = this.parseFields(existing.template.fields);

    if (submit) this.validateAnswers(fields, answers);

    const updated = await this.prisma.formSubmission.update({
      where: { id },
      data: {
        answers: answers as Prisma.InputJsonValue,
        ...(submit
          ? {
              status: FormSubmissionStatus.SUBMITTED,
              submittedAt: new Date(),
            }
          : {}),
      },
      include: submissionInclude,
    });

    await this.audit(
      actor,
      existing.condoId,
      existing.unitId,
      AuditAction.UPDATE,
      'FormSubmission',
      id,
      { status: updated.status },
    );

    this.emitUpdate(updated);
    if (submit) {
      this.events.emit('form.submitted', {
        submissionId: updated.id,
        condoId: existing.condoId,
        userId: actor.id,
        unitId: existing.unitId,
      });
    }
    return updated;
  }

  async cancelSubmission(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.formSubmission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form submission not found');
    if (existing.userId !== actor.id) {
      throw new ForbiddenException('You can only cancel your own submissions');
    }
    if (
      existing.status !== FormSubmissionStatus.DRAFT &&
      existing.status !== FormSubmissionStatus.SUBMITTED
    ) {
      throw new BadRequestException('This submission can no longer be cancelled');
    }

    const updated = await this.prisma.formSubmission.update({
      where: { id },
      data: { status: FormSubmissionStatus.CANCELLED },
      include: submissionInclude,
    });

    await this.audit(
      actor,
      existing.condoId,
      existing.unitId,
      AuditAction.UPDATE,
      'FormSubmission',
      id,
      { status: FormSubmissionStatus.CANCELLED },
    );
    this.emitUpdate(updated);
    return updated;
  }

  async approveSubmission(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!existing) throw new NotFoundException('Form submission not found');
    this.assertManagement(actor, existing.condoId);
    if (existing.status !== FormSubmissionStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted forms can be approved');
    }

    const permitFields = isPermitFormKind(existing.template.kind)
      ? await this.allocatePermitFields(existing.condoId, id, existing.answers)
      : null;

    const updated = await this.prisma.formSubmission.update({
      where: { id },
      data: {
        status: FormSubmissionStatus.APPROVED,
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        reviewNote: null,
        ...(permitFields ?? {}),
      },
      include: submissionInclude,
    });

    await this.audit(
      actor,
      existing.condoId,
      existing.unitId,
      AuditAction.UPDATE,
      'FormSubmission',
      id,
      {
        status: FormSubmissionStatus.APPROVED,
        ...(permitFields?.accessCode ? { accessCode: permitFields.accessCode } : {}),
      },
    );

    this.emitUpdate(updated);
    this.events.emit('form.approved', {
      submissionId: id,
      condoId: existing.condoId,
      userId: existing.userId,
    });
    return updated;
  }

  /**
   * Guard verify for renovation (and similar) form permits by QR payload,
   * short access code, or submission UUID.
   */
  async verifyPermit(
    actor: AuthenticatedUser,
    pass: string,
    condoId?: string,
  ): Promise<FormPermitVerify> {
    const scopeCondoId = condoId ?? this.guardCondoId(actor);
    this.assertGuardOrManagement(actor, scopeCondoId);

    const row = await this.resolvePermitPass(pass, scopeCondoId);
    if (!row) throw new NotFoundException('Permit not found');
    if (row.condoId !== scopeCondoId) {
      throw new ForbiddenException('Permit is not for this condo');
    }
    if (!isPermitFormKind(row.template.kind)) {
      throw new BadRequestException('This form is not a gate-verifiable permit');
    }

    return this.toPermitVerify(row);
  }

  async getPermitQr(actor: AuthenticatedUser, id: string) {
    const row = await this.getSubmission(actor, id);
    if (row.status !== FormSubmissionStatus.APPROVED || !row.qrPayload || !row.accessCode) {
      throw new BadRequestException('This submission has no printable permit yet');
    }
    if (!isPermitFormKind(row.template.kind)) {
      throw new BadRequestException('This form kind does not issue a gate permit');
    }
    const png = await QRCode.toDataURL(row.qrPayload, { errorCorrectionLevel: 'M', width: 512 });
    return {
      qrPayload: row.qrPayload,
      accessCode: row.accessCode,
      png,
      permitValidFrom: row.permitValidFrom,
      permitValidUntil: row.permitValidUntil,
    };
  }

  async exportPermitPdf(actor: AuthenticatedUser, id: string) {
    const row = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: {
        ...submissionInclude,
        condo: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Form submission not found');
    const owns = row.userId === actor.id;
    if (!owns && !this.isManagement(actor, row.condoId)) {
      throw new ForbiddenException('You cannot print this permit');
    }
    if (row.status !== FormSubmissionStatus.APPROVED || !row.accessCode || !row.qrPayload) {
      throw new BadRequestException('Only approved permits with an access code can be printed');
    }
    if (!isPermitFormKind(row.template.kind)) {
      throw new BadRequestException('This form kind does not issue a printable permit');
    }

    const qr = QRCode.create(row.qrPayload, { errorCorrectionLevel: 'M' });
    const modules: boolean[][] = [];
    const size = qr.modules.size;
    for (let rowIdx = 0; rowIdx < size; rowIdx++) {
      const line: boolean[] = [];
      for (let col = 0; col < size; col++) line.push(Boolean(qr.modules.get(rowIdx, col)));
      modules.push(line);
    }

    const answers = (row.answers ?? {}) as Record<string, unknown>;
    const buffer = buildPermitPdf({
      organizationName: row.condo.name,
      permitTitle: row.template.title || 'Renovation permit',
      reference: row.id.slice(0, 8).toUpperCase(),
      unitLabel: row.unit?.identifier ?? '—',
      residentName: row.user?.name ?? '—',
      contractorCompany: stringAnswer(answers, 'contractorCompany'),
      workScope: stringAnswer(answers, 'workScope'),
      validFrom: formatPermitDate(row.permitValidFrom),
      validUntil: formatPermitDate(row.permitValidUntil),
      accessCode: row.accessCode,
      qrModules: modules,
      approvedByName: row.reviewedBy?.name ?? undefined,
      approvedAt: formatPermitDateTime(row.reviewedAt),
    });

    const safeTitle = (row.template.title || 'permit')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return {
      buffer,
      filename: `${safeTitle || 'permit'}-${row.id.slice(0, 8)}.pdf`,
    };
  }

  async rejectSubmission(actor: AuthenticatedUser, id: string, dto: RejectFormSubmissionDto) {
    const existing = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!existing) throw new NotFoundException('Form submission not found');
    this.assertManagement(actor, existing.condoId);
    if (existing.status !== FormSubmissionStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted forms can be rejected');
    }

    const updated = await this.prisma.formSubmission.update({
      where: { id },
      data: {
        status: FormSubmissionStatus.REJECTED,
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote?.trim() || null,
      },
      include: submissionInclude,
    });

    await this.audit(
      actor,
      existing.condoId,
      existing.unitId,
      AuditAction.UPDATE,
      'FormSubmission',
      id,
      { status: FormSubmissionStatus.REJECTED },
    );

    this.emitUpdate(updated);
    this.events.emit('form.rejected', {
      submissionId: id,
      condoId: existing.condoId,
      userId: existing.userId,
      reviewNote: updated.reviewNote,
    });
    return updated;
  }

  private async ensureDefaultTemplates(condoId: string) {
    const existing = await this.prisma.formTemplate.findMany({
      where: {
        condoId,
        kind: { in: DEFAULT_FORM_TEMPLATES.map((t) => t.kind as FormTemplateKind) },
      },
      select: { kind: true },
    });
    const have = new Set(existing.map((r) => r.kind));
    const missing = DEFAULT_FORM_TEMPLATES.filter((t) => !have.has(t.kind as FormTemplateKind));
    if (missing.length === 0) return;

    await this.prisma.formTemplate.createMany({
      data: missing.map((t, idx) => ({
        condoId,
        kind: t.kind as FormTemplateKind,
        title: t.title,
        fields: t.fields as unknown as Prisma.InputJsonValue,
        active: true,
        position: idx,
      })),
    });
  }

  private parseFields(raw: unknown): FormFields {
    const parsed = raw as FormFields;
    if (!parsed?.fields?.length) {
      throw new BadRequestException('Form template has no fields configured');
    }
    return parsed;
  }

  private validateFields(fields: FormFields) {
    if (!fields.fields?.length) {
      throw new BadRequestException('At least one field is required');
    }
    const ids = new Set<string>();
    for (const f of fields.fields) {
      if (ids.has(f.id)) {
        throw new BadRequestException(`Duplicate field id: ${f.id}`);
      }
      ids.add(f.id);
      if (f.type === 'select' && (!f.options || f.options.length === 0)) {
        throw new BadRequestException(`Select field "${f.label}" needs options`);
      }
    }
  }

  private validateAnswers(fields: FormFields, answers: Record<string, unknown>) {
    for (const field of fields.fields) {
      const value = answers[field.id];
      if (field.required) {
        if (value === undefined || value === null || value === '') {
          throw new BadRequestException(`${field.label} is required`);
        }
        if (field.type === 'boolean' && value !== true) {
          throw new BadRequestException(`${field.label} must be confirmed`);
        }
      }
      if (value === undefined || value === null || value === '') continue;
      if (field.type === 'boolean' && typeof value !== 'boolean') {
        throw new BadRequestException(`${field.label} must be yes/no`);
      }
      if (field.type === 'select' && field.options && !field.options.includes(String(value))) {
        throw new BadRequestException(`${field.label} has an invalid selection`);
      }
    }
  }

  private emitUpdate(row: {
    id: string;
    condoId: string;
    userId: string;
    status: FormSubmissionStatus;
  }) {
    this.events.emit('form.updated', {
      condoId: row.condoId,
      submissionId: row.id,
      userId: row.userId,
      status: row.status,
    });
  }

  private async audit(
    actor: AuthenticatedUser,
    condoId: string,
    unitId: string | null,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        condoId,
        unitId,
        actorUserId: actor.id,
        actorRole: actor.activeRole ?? undefined,
        action,
        resourceType,
        resourceId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private assertCondoAccess(actor: AuthenticatedUser, condoId: string) {
    const ok = actor.roles.some((r) => r.condoId === condoId);
    if (!ok) throw new ForbiddenException('No access to this condo');
  }

  private isManagement(actor: AuthenticatedUser, condoId: string): boolean {
    return actor.roles.some(
      (r) =>
        r.condoId === condoId &&
        (r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF),
    );
  }

  private assertManagement(actor: AuthenticatedUser, condoId: string) {
    if (!this.isManagement(actor, condoId)) {
      throw new ForbiddenException('Management access required');
    }
  }

  private async assertActsForUnit(actor: AuthenticatedUser, unitId: string, condoId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.condoId !== condoId) throw new BadRequestException('Invalid unit');
    const ok = actor.roles.some(
      (r) =>
        r.condoId === condoId &&
        (r.unitId === unitId ||
          r.roleId === RoleId.MANAGEMENT_ADMIN ||
          r.roleId === RoleId.MANAGEMENT_STAFF),
    );
    if (!ok) throw new ForbiddenException('You cannot submit forms for this unit');
  }

  private guardCondoId(actor: AuthenticatedUser): string {
    const condoId = actor.activeCondoId;
    if (!condoId) throw new BadRequestException('Active condo context required');
    return condoId;
  }

  private isGuard(actor: AuthenticatedUser, condoId: string): boolean {
    return actor.roles.some((r) => r.condoId === condoId && r.roleId === RoleId.SECURITY_GUARD);
  }

  private assertGuardOrManagement(actor: AuthenticatedUser, condoId: string) {
    if (!this.isGuard(actor, condoId) && !this.isManagement(actor, condoId)) {
      throw new ForbiddenException('Guard or management access required');
    }
  }

  private async uniquePermitAccessCode(condoId: string): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const accessCode = generateAccessCode();
      const [visitorHit, recurringHit, formHit] = await Promise.all([
        this.prisma.visitor.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
          select: { id: true },
        }),
        this.prisma.recurringPass.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
          select: { id: true },
        }),
        this.prisma.formSubmission.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
          select: { id: true },
        }),
      ]);
      if (!visitorHit && !recurringHit && !formHit) return accessCode;
    }
    throw new BadRequestException('Could not allocate access code — try again');
  }

  private async allocatePermitFields(
    condoId: string,
    submissionId: string,
    answers: unknown,
  ): Promise<{
    accessCode: string;
    qrPayload: string;
    permitValidFrom: Date | null;
    permitValidUntil: Date | null;
  }> {
    const accessCode = await this.uniquePermitAccessCode(condoId);
    const record = answers as Record<string, unknown>;
    return {
      accessCode,
      qrPayload: buildQrPayload(condoId, submissionId, accessCode),
      permitValidFrom: parseAnswerDate(record, 'startDate'),
      permitValidUntil: endOfDay(parseAnswerDate(record, 'endDate')),
    };
  }

  private async resolvePermitPass(
    pass: string,
    condoId: string,
  ): Promise<SubmissionWithRelations | null> {
    const normalized = normalizePassInput(pass);

    if (isVisitorId(normalized)) {
      const byId = await this.prisma.formSubmission.findUnique({
        where: { id: normalized },
        include: submissionInclude,
      });
      if (byId) return byId;
    }

    const parsed = parseQrPayload(normalized);
    if (parsed) {
      const byParts = await this.prisma.formSubmission.findFirst({
        where: { id: parsed.visitorId, condoId: parsed.condoId },
        include: submissionInclude,
      });
      if (byParts) return byParts;
    }

    const [byPayload, byCode] = await Promise.all([
      this.prisma.formSubmission.findUnique({
        where: { qrPayload: normalized },
        include: submissionInclude,
      }),
      this.prisma.formSubmission.findUnique({
        where: { condoId_accessCode: { condoId, accessCode: normalized } },
        include: submissionInclude,
      }),
    ]);
    return byPayload ?? byCode ?? null;
  }

  private toPermitVerify(row: SubmissionWithRelations): FormPermitVerify {
    const answers = (row.answers ?? {}) as Record<string, unknown>;
    const now = new Date();
    let valid = row.status === FormSubmissionStatus.APPROVED;
    let message: string | undefined;

    if (row.status !== FormSubmissionStatus.APPROVED) {
      valid = false;
      message = `Permit is ${row.status}`;
    } else if (row.permitValidFrom && row.permitValidFrom > now) {
      valid = false;
      message = 'Permit is not yet valid';
    } else if (row.permitValidUntil && row.permitValidUntil < now) {
      valid = false;
      message = 'Permit has expired';
    }

    return {
      passType: 'form_permit',
      id: row.id,
      condoId: row.condoId,
      status: row.status,
      accessCode: row.accessCode,
      qrPayload: row.qrPayload,
      permitValidFrom: row.permitValidFrom,
      permitValidUntil: row.permitValidUntil,
      templateKind: row.template.kind,
      templateTitle: row.template.title,
      unitLabel: row.unit?.identifier ?? null,
      residentName: row.user?.name ?? null,
      contractorCompany: stringAnswer(answers, 'contractorCompany') ?? null,
      workScope: stringAnswer(answers, 'workScope') ?? null,
      valid,
      message,
    };
  }
}

function stringAnswer(answers: Record<string, unknown>, key: string): string | undefined {
  const value = answers[key];
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

function parseAnswerDate(answers: Record<string, unknown>, key: string): Date | null {
  const raw = answers[key];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Inclusive end-of-day for date-only permit answers (local calendar day). */
function endOfDay(d: Date | null): Date | null {
  if (!d) return null;
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function formatPermitDate(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  return new Date(d).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPermitDateTime(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
