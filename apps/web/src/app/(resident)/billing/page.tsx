'use client';

import { api } from '@/lib/api';
import { useMyUnits, useUnitInvoices } from '@smartresidence/api-client';
import { formatMoney } from '@smartresidence/shared-types';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import Link from 'next/link';

const SKELETON_KEYS = ['s1', 's2', 's3'];

export default function BillingPage() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const invoices = useUnitInvoices(api, unit?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title">Maintenance fees</h2>
        <p className="sr-muted">
          Every line item shows you the formula. We don't believe in hidden charges.
        </p>
      </header>

      {invoices.isLoading ? (
        <div className="flex flex-col gap-3">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
      ) : (invoices.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Your monthly fee statements will appear here once management issues them."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {(invoices.data?.items as any[])?.map((inv) => (
            <Link key={inv.id} href={`/billing/${inv.id}`}>
              <Card className="cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{inv.number}</div>
                    <div className="text-xs sr-muted mt-0.5">
                      {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                      {new Date(inv.periodEnd).toLocaleDateString()} · due{' '}
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatMoney(inv.total, inv.currencyCode)}</div>
                    <Badge
                      tone={
                        inv.status === 'PAID'
                          ? 'success'
                          : inv.status === 'OVERDUE'
                            ? 'danger'
                            : 'primary'
                      }
                    >
                      {inv.status.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );
}
