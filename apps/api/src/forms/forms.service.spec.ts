import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { FormSubmissionStatus, FormTemplateKind, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { FormsService } from './forms.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';
const TEMPLATE_ID = 'tpl-1';

const MOVE_IN_FIELDS = {
  fields: [
    { id: 'moveDate', type: 'date', label: 'Move date', required: true },
    { id: 'occupantNames', type: 'textarea', label: 'Occupant names', required: true },
  ],
};

function resident(): AuthenticatedUser {
  return {
    id: 'owner-1',
    email: 'o@b.c',
    name: 'Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

function manager(): AuthenticatedUser {
  return {
    id: 'mgr-1',
    email: 'm@b.c',
    name: 'Manager',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

const TEMPLATE = {
  id: TEMPLATE_ID,
  condoId: CONDO,
  kind: FormTemplateKind.MOVE_IN,
  title: 'Move-in application',
  fields: MOVE_IN_FIELDS,
  active: true,
  position: 0,
};

function makeService(template: typeof TEMPLATE = TEMPLATE) {
  const submissions: Array<Record<string, unknown>> = [];
  const prisma = {
    formTemplate: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => template),
      createMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => template),
      update: vi.fn(async () => template),
      delete: vi.fn(async () => template),
    },
    formSubmission: {
      findMany: vi.fn(async () => submissions),
      findUnique: vi.fn(async () => submissions[0] ?? null),
      findFirst: vi.fn(async () => submissions[0] ?? null),
      count: vi.fn(async () => submissions.length),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = {
          id: 'sub-1',
          ...args.data,
          template,
          unit: { id: UNIT, identifier: 'A-01-01' },
          user: { id: 'owner-1', name: 'Owner' },
          reviewedBy: null,
        };
        submissions[0] = row;
        return row;
      }),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = {
          ...(submissions[0] ?? {}),
          ...args.data,
          template: (submissions[0]?.template as typeof template) ?? template,
          unit: { id: UNIT, identifier: 'A-01-01' },
          user: { id: 'owner-1', name: 'Owner' },
          reviewedBy: null,
        };
        submissions[0] = row;
        return row;
      }),
    },
    visitor: {
      findUnique: vi.fn(async () => null),
    },
    recurringPass: {
      findUnique: vi.fn(async () => null),
    },
    unit: {
      findUnique: vi.fn(async () => ({ id: UNIT, condoId: CONDO })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return arg(prisma);
      return Promise.all(arg as Array<Promise<unknown>>);
    }),
  } as unknown as PrismaService;
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  const svc = new FormsService(prisma, events);
  return { svc, prisma, events, submissions };
}

describe('FormsService.createSubmission', () => {
  it('creates a draft when submit is false', async () => {
    const { svc, events } = makeService();
    const row = await svc.createSubmission(resident(), {
      templateId: TEMPLATE_ID,
      unitId: UNIT,
      answers: {},
      submit: false,
    });
    expect(row.status).toBe(FormSubmissionStatus.DRAFT);
    expect(events.emit).toHaveBeenCalledWith(
      'form.updated',
      expect.objectContaining({ submissionId: 'sub-1' }),
    );
    expect(events.emit).not.toHaveBeenCalledWith('form.submitted', expect.anything());
  });

  it('requires required fields on submit', async () => {
    const { svc } = makeService();
    await expect(
      svc.createSubmission(resident(), {
        templateId: TEMPLATE_ID,
        unitId: UNIT,
        answers: {},
        submit: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submits and notifies management', async () => {
    const { svc, events } = makeService();
    const row = await svc.createSubmission(resident(), {
      templateId: TEMPLATE_ID,
      unitId: UNIT,
      answers: { moveDate: '2026-07-15', occupantNames: 'Ali & Siti' },
      submit: true,
    });
    expect(row.status).toBe(FormSubmissionStatus.SUBMITTED);
    expect(events.emit).toHaveBeenCalledWith(
      'form.submitted',
      expect.objectContaining({ submissionId: 'sub-1', condoId: CONDO }),
    );
  });
});

describe('FormsService.approveSubmission', () => {
  it('rejects non-management users', async () => {
    const { svc, submissions } = makeService();
    submissions[0] = {
      id: 'sub-1',
      condoId: CONDO,
      unitId: UNIT,
      userId: 'owner-1',
      status: FormSubmissionStatus.SUBMITTED,
      template: TEMPLATE,
    };
    await expect(svc.approveSubmission(resident(), 'sub-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('approves a submitted form', async () => {
    const { svc, submissions, events } = makeService();
    submissions[0] = {
      id: 'sub-1',
      condoId: CONDO,
      unitId: UNIT,
      userId: 'owner-1',
      status: FormSubmissionStatus.SUBMITTED,
      template: TEMPLATE,
      answers: {},
    };
    const row = await svc.approveSubmission(manager(), 'sub-1');
    expect(row.status).toBe(FormSubmissionStatus.APPROVED);
    expect(events.emit).toHaveBeenCalledWith(
      'form.approved',
      expect.objectContaining({ submissionId: 'sub-1', userId: 'owner-1' }),
    );
  });

  it('issues access code + QR when approving a renovation permit', async () => {
    const { svc, submissions, prisma } = makeService();
    const renoTemplate = {
      ...TEMPLATE,
      kind: FormTemplateKind.RENOVATION,
      title: 'Renovation permit',
    };
    submissions[0] = {
      id: 'sub-reno',
      condoId: CONDO,
      unitId: UNIT,
      userId: 'owner-1',
      status: FormSubmissionStatus.SUBMITTED,
      template: renoTemplate,
      answers: {
        workScope: 'Kitchen remodel',
        contractorCompany: 'ABC Builders',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
        depositAcknowledgement: true,
      },
    };
    (prisma.formTemplate.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(renoTemplate);
    (prisma.visitor.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.recurringPass.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.formSubmission.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        if ('condoId_accessCode' in args.where) return null;
        return submissions[0] ?? null;
      },
    );

    const row = await svc.approveSubmission(manager(), 'sub-reno');
    expect(row.status).toBe(FormSubmissionStatus.APPROVED);
    expect(row.accessCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(row.qrPayload).toContain(CONDO);
    expect(row.qrPayload).toContain('sub-reno');
    expect(row.permitValidFrom).toBeTruthy();
    expect(row.permitValidUntil).toBeTruthy();
  });
});

describe('FormsService.verifyPermit', () => {
  function guard(): AuthenticatedUser {
    return {
      id: 'guard-1',
      email: 'g@b.c',
      name: 'Guard',
      locale: 'en',
      activeCondoId: CONDO,
      activeRole: RoleId.SECURITY_GUARD,
      roles: [{ roleId: RoleId.SECURITY_GUARD, condoId: CONDO, unitId: null, permissions: [] }],
    };
  }

  it('verifies an approved renovation permit by access code', async () => {
    const renoTemplate = {
      ...TEMPLATE,
      kind: FormTemplateKind.RENOVATION,
      title: 'Renovation permit',
    };
    const { svc, submissions } = makeService(renoTemplate);
    submissions[0] = {
      id: 'sub-1',
      condoId: CONDO,
      unitId: UNIT,
      userId: 'owner-1',
      status: FormSubmissionStatus.APPROVED,
      accessCode: 'ABC234',
      qrPayload: `${CONDO}:sub-1:ABC234`,
      permitValidFrom: new Date('2026-01-01T00:00:00.000Z'),
      permitValidUntil: new Date('2099-12-31T23:59:59.999Z'),
      answers: { contractorCompany: 'ABC Renovation', workScope: 'Kitchen' },
      template: renoTemplate,
      unit: { id: UNIT, identifier: 'A-01-01' },
      user: { id: 'owner-1', name: 'Owner' },
    };

    const result = await svc.verifyPermit(guard(), 'ABC234');
    expect(result.passType).toBe('form_permit');
    expect(result.valid).toBe(true);
    expect(result.accessCode).toBe('ABC234');
    expect(result.contractorCompany).toBe('ABC Renovation');
  });
});
