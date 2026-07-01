'use client';

import type { PayableMethod } from '@smartresidence/shared-types';
import { GATEWAY_CAPABILITIES, GATEWAY_PROVIDER_SHORT_LABELS } from '@smartresidence/shared-types';
import { Button, cn } from '@smartresidence/ui-web';
import { CreditCard, QrCode, Wallet } from 'lucide-react';

function providerIcon(provider: string) {
  if (provider === 'DUITNOW_QR') return QrCode;
  if (provider === 'STRIPE') return CreditCard;
  return Wallet;
}

export function paymentMethodDisplayName(method: PayableMethod): string {
  return (
    GATEWAY_PROVIDER_SHORT_LABELS[method.provider] ??
    method.label.split('(')[0]?.trim() ??
    method.label
  );
}

export function paymentMethodHint(provider: string): string | undefined {
  return GATEWAY_CAPABILITIES[provider]?.tagline;
}

/** Resident-friendly payment method chooser — uses gateway capability copy for clarity. */
export function PaymentMethodPicker({
  methods,
  value,
  onChange,
  disabled,
  layout = 'select',
  id = 'payment-provider',
}: {
  methods: PayableMethod[];
  value: string;
  onChange: (provider: string) => void;
  disabled?: boolean;
  layout?: 'select' | 'cards';
  id?: string;
}) {
  if (layout === 'select') {
    return (
      <select
        id={id}
        className="sr-select h-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || methods.length === 0}
      >
        {methods.length === 0 ? <option value="">No online method available</option> : null}
        {methods.map((m) => (
          <option key={`${m.provider}-${m.mode}`} value={m.provider}>
            {paymentMethodDisplayName(m)}
            {m.mode === 'TEST' ? ' (test)' : ''}
            {paymentMethodHint(m.provider) ? ` — ${paymentMethodHint(m.provider)}` : ''}
          </option>
        ))}
      </select>
    );
  }

  if (methods.length === 0) {
    return (
      <p className="text-sm sr-muted">
        Online payment is not set up for your building yet. Contact management to pay this invoice.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {methods.map((m) => {
        const selected = value === m.provider;
        const Icon = providerIcon(m.provider);
        const hint = paymentMethodHint(m.provider);
        return (
          <button
            key={`${m.provider}-${m.mode}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.provider)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors touch-manipulation',
              selected
                ? 'border-coral-400 bg-coral-500/10 ring-1 ring-coral-400/40'
                : 'border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] hover:border-coral-300/60',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg',
                selected ? 'bg-coral-500/15 text-coral-600' : 'bg-[rgb(var(--sr-bg))] sr-muted',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {paymentMethodDisplayName(m)}
                {m.mode === 'TEST' ? (
                  <span className="ml-1 text-xs font-normal sr-muted">(test)</span>
                ) : null}
              </span>
              {hint ? <span className="block text-xs sr-muted mt-0.5">{hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PaymentMethodPayButtons({
  methods,
  onPay,
  pending,
  pendingLabel = 'Starting…',
}: {
  methods: PayableMethod[];
  onPay: (provider: string) => void;
  pending?: boolean;
  pendingLabel?: string;
}) {
  if (methods.length === 0) {
    return (
      <p className="text-sm sr-muted mt-1">
        Online payment is not set up for your building yet. Please settle with your management
        office.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 mt-3">
      {methods.map((m) => {
        const Icon = providerIcon(m.provider);
        const hint = paymentMethodHint(m.provider);
        return (
          <Button
            key={`${m.provider}-${m.mode}`}
            type="button"
            variant="secondary"
            className="h-auto min-h-10 flex-col items-start gap-0.5 py-3 px-4 text-left whitespace-normal"
            onClick={() => onPay(m.provider)}
            disabled={pending}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <Icon className="size-4 shrink-0" aria-hidden />
              {paymentMethodDisplayName(m)}
              {m.mode === 'TEST' ? (
                <span className="text-xs font-normal sr-muted">(test)</span>
              ) : null}
            </span>
            {hint ? <span className="text-xs font-normal sr-muted">{hint}</span> : null}
            {!pending ? null : <span className="sr-only">{pendingLabel}</span>}
          </Button>
        );
      })}
    </div>
  );
}
