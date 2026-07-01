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
import { DEFAULT_FORM_TEMPLATES, type FormFields } from '@smartresidence/shared-types';
import type {
  CreateFormSubmissionDto,
  CreateFormTemplateDto,
  ListFormSubmissionsDto,
  RejectFormSubmissionDto,
  UpdateFormSubmissionDto,
  UpdateFormTemplateDto,
} from './dto/forms.dto';

const submissionInclude = {
  template: { select: { id: true, kind: true, title: true, fields: true, active: true } },
  unit: { select: { id: true, identifier: true } },
  user: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.FormSubmissionInclude;

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

    const updated = await this.prisma.formSubmission.update({
      where: { id },
      data: {
        status: FormSubmissionStatus.APPROVED,
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        reviewNote: null,
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
      { status: FormSubmissionStatus.APPROVED },
    );

    this.emitUpdate(updated);
    this.events.emit('form.approved', {
      submissionId: id,
      condoId: existing.condoId,
      userId: existing.userId,
    });
    return updated;
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
}
