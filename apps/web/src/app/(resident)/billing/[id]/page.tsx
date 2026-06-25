'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { queryKeys, usePayInvoice } from '@smartresidence/api-client';
import type { Invoice, InvoiceStatus } from '@smartresidence/shared-types';
import {
  INVOICE_STATUS_LABELS,
  formatMoney,
  invoiceOutstanding,
  isInvoiceOverdue,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useParams } from 'next/navigation';

const STATUS_TONE: Record<InvoiceStatus, 'success' | 'neutral' | 'info' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  VOID: 'neutral',
  OVERDUE: 'danger',
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: () => api.invoice(id),
  });
  const pay = usePayInvoice(api);

  if (invoice.isLoading) return <Skeleton className="h-64" />;
  if (!invoice.data) return <p>Invoice not found.</p>;

  const inv = invoice.data as Invoice & { unit?: { identifier?: string } };
  const outstanding = invoiceOutstanding(inv);
  const overdue = isInvoiceOverdue(inv);
  const settleable = inv.status !== 'PAID' && inv.status !== 'VOID';

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
            {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)} · due {fmtDate(inv.dueDate)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
      </header>

      {inv.status === 'PAID' ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          Paid in full{inv.paidAt ? ` on ${fmtDate(inv.paidAt)}` : ''}. Thank you!
        </div>
      ) : overdue ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="size-4 shrink-0" />
          This invoice is overdue. Please settle {formatMoney(outstanding, inv.currencyCode)} as
          soon as possible.
        </div>
      ) : null}

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
            {inv.lines?.map((l) => (
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
            {Number(inv.amountPaid) > 0 ? (
              <>
                <tr>
                  <td colSpan={2} className="py-1 sr-muted">
                    Paid
                  </td>
                  <td className="py-1 text-right sr-muted">
                    −{formatMoney(inv.amountPaid, inv.currencyCode)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1 font-semibold">
                    Outstanding
                  </td>
                  <td className="py-1 text-right font-semibold">
                    {formatMoney(outstanding, inv.currencyCode)}
                  </td>
                </tr>
              </>
            ) : null}
          </tfoot>
        </table>
      </Card>

      {inv.payments?.length ? (
        <Card>
          <h3 className="font-semibold mb-3">Payment history</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>
                  {formatMoney(p.amount, p.currencyCode)}{' '}
                  <span className="sr-muted">
                    · {p.provider.toLowerCase()}
                    {p.paidAt ? ` · ${fmtDate(p.paidAt)}` : ''}
                  </span>
                </span>
                <Badge tone={p.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                  {p.status.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {settleable ? (
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
