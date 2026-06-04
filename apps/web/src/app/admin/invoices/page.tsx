'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useMyCondos } from '@smartresidence/api-client';
import { formatMoney } from '@smartresidence/shared-types';
import { api } from '@/lib/api';

export default function AdminInvoicesPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

  const invoices = useQuery({
    queryKey: ['admin', 'invoices', condo?.id],
    queryFn: () => {
      if (!condo) return Promise.resolve({ items: [], total: 0 });
      // Use the public invoicesForCondo helper (added to client below)
      return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/invoices/condo/${condo.id}`, {
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('sr.session.v1') ?? '{}').accessToken ?? ''}` },
      })
        .then((r) => r.json())
        .then((d) => d.data ?? d);
    },
    enabled: Boolean(condo),
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="sr-muted">Per-cycle batch generation lives here (v0.2).</p>
      </header>
      {invoices.isLoading ? (
        <Skeleton className="h-40" />
      ) : (invoices.data?.items?.length ?? 0) === 0 ? (
        <EmptyState title="No invoices yet" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted">
              <tr>
                <th className="py-2">Number</th>
                <th>Unit</th>
                <th>Period</th>
                <th>Due</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {invoices.data?.items?.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="py-3 font-mono text-xs">{inv.number}</td>
                  <td>{inv.unit?.identifier ?? '—'}</td>
                  <td className="sr-muted">
                    {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                    {new Date(inv.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="sr-muted">{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td>{formatMoney(inv.total, inv.currencyCode)}</td>
                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
