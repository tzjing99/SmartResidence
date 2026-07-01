'use client';

import { DuitNowQrPanel, type DuitNowQrSession } from '@/components/duitnow-qr-panel';
import { PaymentMethodPayButtons } from '@/components/payment-method-picker';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { queryKeys, usePayInvoice, usePayableMethods } from '@smartresidence/api-client';
import type { Invoice, InvoiceStatus } from '@smartresidence/shared-types';
import {
  GATEWAY_PROVIDER_SHORT_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatMoney,
  invoiceOutstanding,
  isInvoiceOverdue,
  paymentStatusTone,
  visibleInvoicePayments,
} from '@smartresidence/shared-types';
import { Badge, Card, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';

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
  const searchParams = useSearchParams();
  const returnedFromGateway = searchParams.get('paid') === '1';
  const invoice = useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: () => api.invoice(id),
    refetchInterval: (query) => {
      const data = query.state.data as Invoice | undefined;
      const hasPending = data?.payments?.some((p) => p.status === 'PENDING') ?? false;
      return returnedFromGateway && data?.status !== 'PAID' && hasPending ? 3000 : false;
    },
  });
  const pay = usePayInvoice(api);
  const [qrSession, setQrSession] = useState<DuitNowQrSession | null>(null);
  const condoId = (invoice.data as { condoId?: string } | undefined)?.condoId ?? null;
  const methods = usePayableMethods(api, condoId);

  if (invoice.isLoading) return <Skeleton className="h-64" />;
  if (!invoice.data) return <p>Invoice not found.</p>;

  const inv = invoice.data as Invoice & { unit?: { identifier?: string }; condoId: string };
  const outstanding = invoiceOutstanding(inv);
  const overdue = isInvoiceOverdue(inv);
  const paymentHistory = visibleInvoicePayments(inv.payments ?? []);
  const pendingPayment = paymentHistory.find((p) => p.status === 'PENDING');
  const settleable = inv.status !== 'PAID' && inv.status !== 'VOID' && outstanding > 0.005;

  function buildReturnUrl(provider: string) {
    const appReturn =
      typeof window !== 'undefined' ? `${window.location.origin}/billing/${id}?paid=1` : undefined;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    if (!appReturn) return undefined;
    if (provider === 'RAZER') {
      return `${apiBase}/api/webhooks/payments/fiuu/return?next=${encodeURIComponent(appReturn)}`;
    }
    if (provider === 'IPAY88') {
      return `${apiBase}/api/webhooks/payments/ipay88/return?next=${encodeURIComponent(appReturn)}`;
    }
    return appReturn;
  }

  async function payNow(provider: string) {
    try {
      const returnUrl = buildReturnUrl(provider);
      const res = await pay.mutateAsync({ id, provider, returnUrl });
      if (res.qrPayload || res.qrImageUrl) {
        setQrSession({
          qrPayload: res.qrPayload,
          qrImageUrl: res.qrImageUrl,
          paymentId: res.paymentId,
          amountLabel: formatMoney(outstanding, inv.currencyCode),
        });
        return;
      }
      if (res.formPost) {
        // Build and auto-submit a hidden form to the gateway's hosted page.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.formPost.url;
        for (const [name, value] of Object.entries(res.formPost.fields)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      toast.success('Payment started. Follow the gateway prompts to complete it.');
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
      ) : returnedFromGateway || pendingPayment ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          {pendingPayment ? (
            <>
              {GATEWAY_PROVIDER_SHORT_LABELS[pendingPayment.provider] ?? pendingPayment.provider}{' '}
              payment is being confirmed. You can choose a different method below — the previous
              attempt will be cancelled.
            </>
          ) : (
            <>Payment is being confirmed by the gateway. This may take a moment.</>
          )}
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

      {paymentHistory.length ? (
        <Card>
          <h3 className="font-semibold mb-3">Payment history</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {paymentHistory.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>
                  {formatMoney(p.amount, p.currencyCode)}{' '}
                  <span className="sr-muted">
                    · {GATEWAY_PROVIDER_SHORT_LABELS[p.provider] ?? p.provider}
                    {p.paidAt ? ` · ${fmtDate(p.paidAt)}` : ''}
                  </span>
                </span>
                <Badge tone={paymentStatusTone(p.status)}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {settleable ? (
        <Card>
          <h3 className="font-semibold mb-1">Pay {formatMoney(outstanding, inv.currencyCode)}</h3>
          {qrSession ? (
            <DuitNowQrPanel
              session={qrSession}
              onClose={() => setQrSession(null)}
              onSettled={() => {
                void invoice.refetch();
                setQrSession(null);
              }}
            />
          ) : (methods.data?.length ?? 0) === 0 ? (
            <p className="text-sm sr-muted mt-1">
              Online payment isn&apos;t enabled for your condo yet. Please settle this invoice with
              your management office.
            </p>
          ) : (
            <>
              <p className="text-sm sr-muted mt-1 mb-1">
                Choose how you&apos;d like to pay. DuitNow QR stays on this page; Fiuu and iPay88
                open their secure payment page.
              </p>
              <PaymentMethodPayButtons
                methods={methods.data ?? []}
                onPay={(provider) => void payNow(provider)}
                pending={pay.isPending}
              />
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
