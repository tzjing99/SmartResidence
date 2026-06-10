'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { queryKeys, usePayInvoice } from '@smartresidence/api-client';
import { formatMoney } from '@smartresidence/shared-types';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: () => api.invoice(id),
  });
  const pay = usePayInvoice(api);

  if (invoice.isLoading) return <Skeleton className="h-64" />;
  if (!invoice.data) return <p>Invoice not found.</p>;

  const inv = invoice.data as any;

  async function payNow(provider: string) {
    try {
      const res = await pay.mutateAsync({ id, provider });
      if (res.redirectUrl) window.location.href = res.redirectUrl;
      else toast.success('Payment intent created');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="sr-section-title">{inv.number}</h2>
          <p className="sr-muted">
            {new Date(inv.periodStart).toLocaleDateString()} –{' '}
            {new Date(inv.periodEnd).toLocaleDateString()} · due{' '}
            {new Date(inv.dueDate).toLocaleDateString()}
          </p>
        </div>
        <Badge
          tone={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'primary'}
        >
          {inv.status.toLowerCase()}
        </Badge>
      </header>

      <Card>
        <h3 className="font-semibold mb-3">Line items</h3>
        <table className="w-full text-sm">
          <thead className="text-left sr-muted text-xs uppercase">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2">Formula</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--sr-border))]">
            {inv.lines?.map((l: any) => (
              <tr key={l.id}>
                <td className="py-3">
                  <div className="font-medium">{l.description}</div>
                  <div className="text-xs sr-muted">{l.code}</div>
                </td>
                <td className="py-3 sr-muted text-xs">{l.formula ?? '—'}</td>
                <td className="py-3 text-right font-medium">
                  {formatMoney(l.amount, inv.currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[rgb(var(--sr-border))]">
              <td colSpan={2} className="py-3 font-semibold">
                Total
              </td>
              <td className="py-3 text-right font-semibold">
                {formatMoney(inv.total, inv.currencyCode)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {inv.status !== 'PAID' && inv.status !== 'VOID' ? (
        <div className="flex gap-3">
          <Button onClick={() => payNow('STRIPE')} disabled={pay.isPending}>
            Pay with card
          </Button>
          <Button variant="secondary" onClick={() => payNow('FPX')} disabled={pay.isPending}>
            Pay with FPX
          </Button>
        </div>
      ) : null}
    </div>
  );
}
