'use client';

import { DuitNowQrPanel, type DuitNowQrSession } from '@/components/duitnow-qr-panel';
import { PaymentMethodPicker } from '@/components/payment-method-picker';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  type DepositListItem,
  type ReceiptListItem,
  useCreateAdvancePayment,
  useMyUnits,
  usePayableMethods,
  useUnitAccessRestrictionStatus,
  useUnitDeposits,
  useUnitInvoices,
  useUnitReceipts,
  useUnitStatement,
} from '@smartresidence/api-client';
import type {
  DepositStatus,
  Invoice,
  InvoiceStatus,
  ReceiptKind,
} from '@smartresidence/shared-types';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_TYPE_LABELS,
  INVOICE_STATUS_LABELS,
  depositHeldAmount,
  formatMoney,
  invoiceOutstanding,
  isInvoiceOverdue,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import {
  ArrowRight,
  Download,
  FileText,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

const SKELETON_KEYS = ['s1', 's2', 's3'];
const ADVANCE_PRESETS = [100, 200, 400, 1000];

const STATUS_TONE: Record<InvoiceStatus, 'success' | 'neutral' | 'info' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  VOID: 'neutral',
  OVERDUE: 'danger',
};

const DEPOSIT_TONE: Record<DepositStatus, 'success' | 'neutral' | 'info' | 'warning'> = {
  HELD: 'info',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'success',
  FORFEITED: 'neutral',
};

async function downloadReceipt(receiptId: string, number: string) {
  try {
    const blob = await api.downloadReceiptPdf(receiptId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error((err as Error).message);
  }
}

async function downloadStatementCsv(unitId: string, label: string) {
  try {
    const blob = await api.downloadUnitStatementCsv(unitId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error((err as Error).message);
  }
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function receiptKindLabel(kind: ReceiptKind) {
  switch (kind) {
    case 'PAYMENT':
      return 'Maintenance payment receipt';
    case 'DEPOSIT':
      return 'Deposit payment receipt';
    case 'REFUND':
      return 'Deposit refund receipt';
    default:
      return 'Receipt';
  }
}

function AdvanceMaintenancePayment({
  unitId,
  condoId,
}: {
  unitId: string;
  condoId: string | null;
}) {
  const t = useT();
  const methods = usePayableMethods(api, condoId);
  const createAdvance = useCreateAdvancePayment(api);
  const accessStatus = useUnitAccessRestrictionStatus(api, unitId);
  const wasRestrictedRef = React.useRef(false);
  const [selected, setSelected] = React.useState<number | 'OTHER'>(100);
  const [customAmount, setCustomAmount] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [qrSession, setQrSession] = React.useState<DuitNowQrSession | null>(null);

  React.useEffect(() => {
    if (accessStatus.data?.restricted) wasRestrictedRef.current = true;
  }, [accessStatus.data?.restricted]);

  React.useEffect(() => {
    const first = methods.data?.[0]?.provider;
    if (!provider && first) setProvider(first);
  }, [methods.data, provider]);

  const amount = selected === 'OTHER' ? Number(customAmount) : selected;

  async function startAdvancePayment() {
    if (!provider) {
      toast.error(t('billing.chooseMethodToast'));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t('billing.enterAmountToast'));
      return;
    }
    try {
      const appReturn =
        typeof window !== 'undefined' ? `${window.location.origin}/billing?advance=1` : undefined;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const returnUrl =
        provider === 'RAZER' && appReturn
          ? `${apiBase}/api/webhooks/payments/fiuu/return?next=${encodeURIComponent(appReturn)}`
          : provider === 'IPAY88' && appReturn
            ? `${apiBase}/api/webhooks/payments/ipay88/return?next=${encodeURIComponent(appReturn)}`
            : provider === 'TNG' && appReturn
              ? `${apiBase}/api/webhooks/payments/tng/return?next=${encodeURIComponent(appReturn)}`
              : appReturn;
      const res = await createAdvance.mutateAsync({
        unitId,
        amount,
        provider: provider as never,
        returnUrl,
      });

      if (res.qrPayload || res.qrImageUrl) {
        setQrSession({
          qrPayload: res.qrPayload,
          qrImageUrl: res.qrImageUrl,
          advancePaymentId: res.advancePaymentId,
          amountLabel: formatMoney(amount),
        });
        return;
      }
      if (res.formPost) {
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
      toast.success(t('billing.advanceStartedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card className="border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs uppercase sr-muted font-semibold">Pay maintenance in advance</div>
          <h3 className="text-xl font-semibold mt-1">Add credit for future maintenance fees</h3>
          <p className="text-sm sr-muted mt-1">
            Choose an amount or enter your own. After your bank confirms payment, the credit is
            saved to your unit and will automatically reduce your next maintenance fee invoice.
          </p>
        </div>
        <div className="text-sm sr-muted lg:text-right">
          Credit is added only after successful gateway confirmation.
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {ADVANCE_PRESETS.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={selected === value ? 'primary' : 'secondary'}
            className={
              selected === value
                ? 'border-emerald-400 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700'
                : 'hover:border-emerald-300'
            }
            onClick={() => setSelected(value)}
          >
            {formatMoney(value)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={selected === 'OTHER' ? 'primary' : 'secondary'}
          className={
            selected === 'OTHER'
              ? 'border-emerald-400 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700'
              : 'hover:border-emerald-300'
          }
          onClick={() => setSelected('OTHER')}
        >
          Other amount
        </Button>
      </div>

      {qrSession ? (
        <div className="mt-5">
          <DuitNowQrPanel
            session={qrSession}
            onClose={() => setQrSession(null)}
            showAccessRestored={wasRestrictedRef.current}
          />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {selected === 'OTHER' ? (
            <div className="flex flex-col gap-1.5 max-w-xs">
              <label className="text-xs sr-muted font-medium" htmlFor="advance-custom-amount">
                Other amount (MYR)
              </label>
              <input
                id="advance-custom-amount"
                type="number"
                min="1"
                step="0.01"
                className="sr-input"
                value={customAmount}
                placeholder="Enter amount"
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] px-3 py-2 max-w-xs">
              <div className="text-xs sr-muted">Selected amount</div>
              <div className="font-semibold">{formatMoney(amount || 0)}</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs sr-muted font-medium" htmlFor="advance-provider">
              How would you like to pay?
            </label>
            <PaymentMethodPicker
              id="advance-provider"
              layout="cards"
              methods={methods.data ?? []}
              value={provider}
              onChange={setProvider}
              disabled={createAdvance.isPending || (methods.data?.length ?? 0) === 0}
            />
          </div>

          <Button
            type="button"
            className="self-start"
            disabled={createAdvance.isPending || !provider || (methods.data?.length ?? 0) === 0}
            loading={createAdvance.isPending}
            onClick={() => void startAdvancePayment()}
          >
            Pay maintenance in advance
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function BillingPage() {
  const t = useT();
  const units = useMyUnits(api);
  const unitList = (units.data ?? []) as Array<{
    id: string;
    condoId?: string;
    identifier?: string;
  }>;
  const unit = unitList[0];
  const unitId = unit?.id ?? null;
  const condoId = unit?.condoId ?? null;
  const invoices = useUnitInvoices(api, unitId);
  const deposits = useUnitDeposits(api, unitId);
  const receipts = useUnitReceipts(api, unitId);
  const statement = useUnitStatement(api, unitId);

  const invoiceItems = invoices.data?.items ?? [];
  const depositItems = deposits.data?.items ?? [];
  const receiptItems = receipts.data?.items ?? [];
  const openInvoiceItems = invoiceItems.filter((inv) => {
    const outstanding = invoiceOutstanding(inv);
    return inv.status !== 'PAID' && inv.status !== 'VOID' && outstanding > 0.005;
  });
  const openInvoiceTotal = openInvoiceItems.reduce((sum, inv) => sum + invoiceOutstanding(inv), 0);
  const heldDepositTotal = depositItems.reduce((sum, d) => sum + depositHeldAmount(d), 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title">{t('billing.title')}</h2>
          <p className="sr-muted">
            {t('billing.subtitle')} Deposits are refundable amounts held by management and are
            tracked separately.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-[rgb(var(--sr-coral))]/30 bg-[rgb(var(--message-mgmt-coral-bg))]/45">
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[rgb(var(--sr-card))] border border-[rgb(var(--sr-border))]">
                  <FileText className="size-5 text-[rgb(var(--sr-coral))]" />
                </span>
                <div>
                  <div className="text-xs uppercase sr-muted font-semibold">Payable invoices</div>
                  <h3 className="text-xl font-semibold mt-1">Maintenance fees</h3>
                  <p className="text-sm sr-muted mt-1">
                    Monthly charges, sinking fund and other invoice items issued for your unit.
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {invoices.isLoading ? 'Checking...' : formatMoney(openInvoiceTotal)}
                  </div>
                  <div className="text-xs sr-muted">
                    {invoices.isLoading
                      ? 'Loading maintenance fee invoices'
                      : openInvoiceItems.length
                        ? `${openInvoiceItems.length} invoice${
                            openInvoiceItems.length === 1 ? '' : 's'
                          } to settle`
                        : 'No maintenance fees due now'}
                  </div>
                </div>
                <Button asChild>
                  <a href="#maintenance-fees">
                    Pay / view invoices
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border-sky-200/70 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20">
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[rgb(var(--sr-card))] border border-[rgb(var(--sr-border))]">
                  <WalletCards className="size-5 text-sky-600 dark:text-sky-300" />
                </span>
                <div>
                  <div className="text-xs uppercase sr-muted font-semibold">Refundable records</div>
                  <h3 className="text-xl font-semibold mt-1">Deposits</h3>
                  <p className="text-sm sr-muted mt-1">
                    Renovation, access card, move-in/out and other deposits held by management.
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {deposits.isLoading ? 'Checking...' : formatMoney(heldDepositTotal)}
                  </div>
                  <div className="text-xs sr-muted">
                    {deposits.isLoading
                      ? 'Loading deposit records'
                      : depositItems.length
                        ? `${depositItems.length} deposit record${
                            depositItems.length === 1 ? '' : 's'
                          } on file`
                        : 'No deposits recorded yet'}
                  </div>
                </div>
                <Button asChild variant="secondary">
                  <a href="#deposits">
                    Check deposit status
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {statement.data ? (
        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <div className="text-xs uppercase sr-muted font-semibold">Amount to pay now</div>
              <div className="text-2xl font-bold mt-1">
                {formatMoney(statement.data.totalOutstanding)}
              </div>
              <p className="text-xs sr-muted mt-1">Unpaid maintenance fee invoices.</p>
            </Card>
            <Card>
              <div className="text-xs uppercase sr-muted font-semibold">Credit on your account</div>
              <div className="text-2xl font-bold mt-1">
                {formatMoney(statement.data.creditBalance)}
              </div>
              <p className="text-xs sr-muted mt-1">Prepaid balance that can offset future fees.</p>
            </Card>
          </div>
          {unitList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {unitList.map((u) => (
                <Button
                  key={u.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadStatementCsv(u.id, u.identifier ?? u.id)}
                >
                  <Download className="size-4" />
                  Download statement (CSV)
                  {unitList.length > 1 ? ` · ${u.identifier ?? u.id}` : ''}
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {unitId && condoId ? <AdvanceMaintenancePayment unitId={unitId} condoId={condoId} /> : null}

      <section id="maintenance-fees" className="scroll-mt-24 flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title">Maintenance fee invoices</h2>
          <p className="sr-muted">
            These are invoices for your monthly maintenance charges and any other fee items. Open an
            invoice to pay online or view the full breakdown.
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
            title={t('billing.noInvoicesTitle')}
            description="Your monthly fee statements will appear here once management issues them."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {invoiceItems.map((inv: Invoice) => {
              const outstanding = invoiceOutstanding(inv);
              const overdue = isInvoiceOverdue(inv);
              const settleable =
                inv.status !== 'PAID' && inv.status !== 'VOID' && outstanding > 0.005;
              return (
                <Card key={inv.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{inv.number}</div>
                        <Badge tone={STATUS_TONE[inv.status as InvoiceStatus] ?? 'neutral'}>
                          {overdue && inv.status !== 'OVERDUE'
                            ? 'Overdue'
                            : (INVOICE_STATUS_LABELS[inv.status as InvoiceStatus] ?? inv.status)}
                        </Badge>
                      </div>
                      <div className="text-xs sr-muted mt-1">
                        Fee period {fmtDate(inv.periodStart)} to {fmtDate(inv.periodEnd)} · due{' '}
                        {fmtDate(inv.dueDate)}
                      </div>
                      <p className="text-xs sr-muted mt-2">
                        {settleable
                          ? 'Payment is required for this maintenance fee invoice.'
                          : 'Invoice record only. No payment is needed right now.'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:text-right">
                      <div className="font-semibold">
                        {formatMoney(outstanding, inv.currencyCode)}
                      </div>
                      {Number(inv.amountPaid) > 0 && outstanding > 0.005 ? (
                        <div className="text-[11px] sr-muted">
                          of {formatMoney(inv.total, inv.currencyCode)}
                        </div>
                      ) : null}
                      <Button asChild size="sm" variant={settleable ? 'primary' : 'secondary'}>
                        <Link href={`/billing/${inv.id}`}>
                          {settleable ? 'Pay invoice' : 'View invoice'}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      <section id="deposits" className="scroll-mt-24 flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title">Deposits</h2>
          <p className="sr-muted">
            These are not bills to pay from this page. They show deposit receipts, held balances and
            refund status for your unit.
          </p>
        </header>
        {deposits.isLoading ? (
          <Skeleton className="h-24" />
        ) : depositItems.length === 0 ? (
          <EmptyState
            title={t('billing.noDepositsTitle')}
            description="Renovation, delivery and other deposits will show here once recorded."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {depositItems.map((d: DepositListItem) => {
              const held = depositHeldAmount(d);
              const receipt = d.receipt;
              return (
                <Card key={d.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{DEPOSIT_TYPE_LABELS[d.type]}</div>
                        <Badge tone={DEPOSIT_TONE[d.status]}>
                          {DEPOSIT_STATUS_LABELS[d.status]}
                        </Badge>
                      </div>
                      <div className="text-xs sr-muted mt-1">
                        Paid {fmtDate(d.paidAt)} · currently held{' '}
                        {formatMoney(held, d.currencyCode)}
                      </div>
                      <p className="text-xs sr-muted mt-2">
                        Deposit status only. This record does not require online payment.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:text-right">
                      <div className="font-semibold">{formatMoney(d.amount, d.currencyCode)}</div>
                      {receipt ? (
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgb(var(--sr-border))] px-3 text-sm font-medium text-[rgb(var(--sr-coral))] hover:bg-[rgb(var(--sr-bg))]"
                          onClick={() => downloadReceipt(receipt.id, receipt.number)}
                        >
                          <ReceiptText className="size-4" />
                          View receipt
                        </button>
                      ) : (
                        <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgb(var(--sr-border))] px-3 text-sm font-medium sr-muted">
                          <ShieldCheck className="size-4" />
                          Deposit status
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title">Receipts and payment records</h2>
          <p className="sr-muted">
            Download official PDFs for maintenance payments, deposit payments and deposit refunds.
          </p>
        </header>
        {receipts.isLoading ? (
          <Skeleton className="h-24" />
        ) : receiptItems.length === 0 ? (
          <EmptyState
            title={t('billing.noReceiptsTitle')}
            description="Receipts appear here once issued."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {receiptItems.map((r: ReceiptListItem) => (
              <Card key={r.id} className="!py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium font-mono text-sm">{r.number}</div>
                    <div className="text-xs sr-muted">
                      {receiptKindLabel(r.kind)} · issued {fmtDate(r.issuedAt)} ·{' '}
                      {formatMoney(r.amount, r.currencyCode)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
                    onClick={() => downloadReceipt(r.id, r.number)}
                  >
                    <Download className="size-4" />
                    Download PDF
                  </button>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
