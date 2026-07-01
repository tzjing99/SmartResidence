import { buildCsv } from '@/billing/csv-utils';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { VendorBillStatus } from '@prisma/client';
import { VENDOR_BILL_FUND_LABELS, type VendorBillFund } from '@smartresidence/shared-types';
import { assertManagement } from './procurement-access';
import { parseDateOnly } from './vendor-bill.service';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseDateRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const fromDate = from ? startOfDay(parseDateOnly(from, 'from')) : startOfMonth(now);
  const toDate = to ? endOfDay(parseDateOnly(to, 'to')) : endOfDay(now);
  if (fromDate > toDate) {
    throw new BadRequestException('from must be on or before to');
  }
  return { from: fromDate, to: toDate };
}

@Injectable()
export class VendorBillExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async vendorSpendByFundCsv(user: AuthenticatedUser, condoId: string, from?: string, to?: string) {
    assertManagement(user, condoId);
    const range = parseDateRange(from, to);

    const rows = await this.prisma.vendorBill.groupBy({
      by: ['fund'],
      where: {
        condoId,
        status: VendorBillStatus.PAID,
        paidAt: { gte: range.from, lte: range.to },
        fund: { in: ['MAINTENANCE', 'SINKING_FUND', 'GENERAL'] },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const byFund = new Map<VendorBillFund, { total: number; count: number }>();
    for (const fund of ['MAINTENANCE', 'SINKING_FUND', 'GENERAL'] as VendorBillFund[]) {
      byFund.set(fund, { total: 0, count: 0 });
    }
    for (const row of rows) {
      const fund = row.fund as VendorBillFund;
      byFund.set(fund, {
        total: Number(row._sum.amount ?? 0),
        count: row._count.id,
      });
    }

    const detailRows = await this.prisma.vendorBill.findMany({
      where: {
        condoId,
        status: VendorBillStatus.PAID,
        paidAt: { gte: range.from, lte: range.to },
        fund: { in: ['MAINTENANCE', 'SINKING_FUND', 'GENERAL'] },
      },
      include: { vendor: { select: { name: true } } },
      orderBy: [{ fund: 'asc' }, { paidAt: 'asc' }],
    });

    const csvRows: string[][] = [
      ['Vendor spend by fund (AGM report)'],
      [
        `Period: ${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}`,
      ],
      [],
      ['Fund', 'Total paid (MYR)', 'Bill count'],
      ...(['MAINTENANCE', 'SINKING_FUND', 'GENERAL'] as VendorBillFund[]).map((fund) => {
        const agg = byFund.get(fund) ?? { total: 0, count: 0 };
        return [VENDOR_BILL_FUND_LABELS[fund], agg.total.toFixed(2), String(agg.count)];
      }),
      [],
      ['Bill number', 'Vendor', 'Fund', 'Amount (MYR)', 'Paid date', 'Description'],
      ...detailRows.map((b) => [
        b.billNumber,
        b.vendor.name,
        VENDOR_BILL_FUND_LABELS[b.fund as VendorBillFund],
        Number(b.amount).toFixed(2),
        b.paidAt ? b.paidAt.toISOString().slice(0, 10) : '',
        b.description ?? '',
      ]),
    ];

    const filename = `vendor-spend-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
    return { csv: buildCsv(csvRows), filename };
  }
}
