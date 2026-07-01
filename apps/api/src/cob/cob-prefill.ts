import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleId } from '@prisma/client';
import {
  COB_TEMPLATE_DESCRIPTION,
  COB_TEMPLATE_LABEL,
  COB_TEMPLATE_SLUG,
  FUND_LABELS,
  type CobPrefillDataSource,
  type CobPrefillSnapshot,
  type CobTemplateKind,
  type CobTemplateListItem,
  type CobTemplateListResponse,
  formatMoney,
  type LedgerFund,
} from '@smartresidence/shared-types';
import { LedgerService } from '../billing/ledger.service';
import { parseReceiptTemplate } from '../billing/receipt-template';

/** Internal shape passed to PDF builders. */
export interface CobPrefillContext {
  organizationName: string;
  registrationNo?: string;
  address: string;
  blockCount: number;
  unitCount: number;
  asAtDate: Date;
  reportingFrom?: Date;
  reportingTo?: Date;
  managementCommittee: Array<{ name: string; role: string; email: string | null }>;
  fundBalances: Array<{ fund: string; label: string; balanceFormatted: string }>;
  fundSummaryRows: Array<{
    fund: string;
    openingBalance: number;
    collections: number;
    chargesIssued: number;
    adjustments: number;
    closingBalance: number;
  }>;
  signatoryName?: string;
  signatoryTitle?: string;
}

const COB_TEMPLATE_KIND_VALUES = [
  'ANNUAL_RETURN',
  'FINANCIAL_SUMMARY',
  'MEETING_MINUTES_COVER',
  'INSURANCE_REGISTER',
] as const satisfies readonly CobTemplateKind[];

const DATA_SOURCES: CobPrefillDataSource[] = [
  { field: 'Organization name', source: 'Condo settings → Billing → Receipt template' },
  { field: 'Registration no.', source: 'Condo settings → Billing → Receipt template' },
  { field: 'Address', source: 'Condo profile address' },
  { field: 'Block / unit counts', source: 'Blocks and units registered in SmartResidence' },
  {
    field: 'Management committee',
    source: 'Users with Management admin role for this condo (+ receipt signatory)',
  },
  { field: 'Fund balances', source: 'Latest ledger cash balances (excludes uncollected charges)' },
  {
    field: 'Period movement',
    source: 'Fund summary report for the selected date range (Accounting exports)',
  },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseReportingRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  return {
    from: from ? startOfDay(new Date(from)) : startOfMonth(now),
    to: to ? endOfDay(new Date(to)) : endOfDay(now),
  };
}

@Injectable()
export class CobPrefillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async buildContext(
    condoId: string,
    from?: string,
    to?: string,
  ): Promise<CobPrefillContext> {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const template = parseReceiptTemplate(condo.settings);
    const range = parseReportingRange(from, to);

    const [blockCount, unitCount, mcAssignments, balances, summary] = await Promise.all([
      this.prisma.block.count({ where: { condoId } }),
      this.prisma.unit.count({ where: { condoId } }),
      this.prisma.roleAssignment.findMany({
        where: {
          condoId,
          roleId: RoleId.MANAGEMENT_ADMIN,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { grantedAt: 'asc' },
      }),
      this.ledger.fundBalances(condoId),
      this.ledger.fundSummary(condoId, range.from, range.to),
    ]);

    const committee = mcAssignments.map((a) => ({
      name: a.user.name,
      role: 'Management committee',
      email: a.user.email,
    }));

    if (template.signatoryName) {
      const exists = committee.some(
        (m) => m.name.toLowerCase() === template.signatoryName.toLowerCase(),
      );
      if (!exists) {
        committee.unshift({
          name: template.signatoryName,
          role: template.signatoryTitle || 'Signatory (receipt template)',
          email: null,
        });
      }
    }

    return {
      organizationName: template.organizationName || condo.name,
      registrationNo: template.registrationNo || undefined,
      address: template.addressLines?.replace(/\n/g, ', ') || condo.address,
      blockCount,
      unitCount,
      asAtDate: range.to,
      reportingFrom: range.from,
      reportingTo: range.to,
      managementCommittee: committee,
      fundBalances: balances.map((b) => ({
        fund: b.fund,
        label: FUND_LABELS[b.fund as LedgerFund],
        balanceFormatted: formatMoney(b.balance),
      })),
      fundSummaryRows: summary.funds,
      signatoryName: template.signatoryName || undefined,
      signatoryTitle: template.signatoryTitle || undefined,
    };
  }

  async listTemplates(
    condoId: string,
    from?: string,
    to?: string,
  ): Promise<CobTemplateListResponse> {
    const ctx = await this.buildContext(condoId, from, to);
    const templates: CobTemplateListItem[] = COB_TEMPLATE_KIND_VALUES.map((kind) => ({
      kind,
      slug: COB_TEMPLATE_SLUG[kind],
      label: COB_TEMPLATE_LABEL[kind],
      description: COB_TEMPLATE_DESCRIPTION[kind],
      downloadPath: `/api/cob/condo/${condoId}/templates/${COB_TEMPLATE_SLUG[kind]}.pdf`,
    }));

    const prefill: CobPrefillSnapshot = {
      asAtDate: ctx.asAtDate.toISOString().slice(0, 10),
      organizationName: ctx.organizationName,
      registrationNo: ctx.registrationNo ?? null,
      address: ctx.address,
      blockCount: ctx.blockCount,
      unitCount: ctx.unitCount,
      managementCommittee: ctx.managementCommittee,
      fundBalances: ctx.fundBalances.map((f) => ({
        fund: f.fund,
        label: f.label,
        balance: f.balanceFormatted,
      })),
      reportingPeriod:
        ctx.reportingFrom && ctx.reportingTo
          ? {
              from: ctx.reportingFrom.toISOString().slice(0, 10),
              to: ctx.reportingTo.toISOString().slice(0, 10),
            }
          : null,
      dataSources: DATA_SOURCES,
    };

    return {
      templates,
      prefill,
      disclaimer:
        'Templates are filing aids only — not legal advice. Verify all entries before submitting to the Commissioner of Buildings.',
    };
  }

  slugToKind(slug: string): CobTemplateKind | null {
    const normalized = slug.replace(/\.pdf$/i, '').toLowerCase();
    const entry = Object.entries(COB_TEMPLATE_SLUG).find(([, s]) => s === normalized);
    return entry ? (entry[0] as CobTemplateKind) : null;
  }
}
