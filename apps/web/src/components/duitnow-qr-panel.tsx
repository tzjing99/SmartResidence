'use client';

import { api } from '@/lib/api';
import {
  usePollDuitNowAdvanceStatus,
  usePollDuitNowInvoiceStatus,
} from '@smartresidence/api-client';
import { Button, Card } from '@smartresidence/ui-web';
import { Smartphone } from 'lucide-react';
import * as React from 'react';

export type DuitNowQrSession = {
  qrPayload?: string;
  qrImageUrl?: string;
  paymentId?: string;
  advancePaymentId?: string;
  amountLabel?: string;
};

export function DuitNowQrPanel({
  session,
  onClose,
  onSettled,
}: {
  session: DuitNowQrSession;
  onClose: () => void;
  onSettled?: () => void;
}) {
  const invoicePoll = usePollDuitNowInvoiceStatus(
    api,
    session.paymentId ?? null,
    Boolean(session.paymentId),
  );
  const advancePoll = usePollDuitNowAdvanceStatus(
    api,
    session.advancePaymentId ?? null,
    Boolean(session.advancePaymentId),
  );
  const poll = session.paymentId ? invoicePoll : advancePoll;

  React.useEffect(() => {
    if (poll.data?.settled) onSettled?.();
  }, [poll.data?.settled, onSettled]);

  return (
    <Card className="border-[rgb(var(--sr-coral))]/30 bg-[rgb(var(--sr-bg))]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Smartphone className="size-4 text-[rgb(var(--sr-coral))]" />
          Scan with your banking app (DuitNow QR)
        </div>
        {session.amountLabel ? (
          <p className="text-sm sr-muted">Amount: {session.amountLabel}</p>
        ) : null}
        {session.qrImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.qrImageUrl}
            alt="DuitNow QR code"
            className="size-64 rounded-xl border border-[rgb(var(--sr-border))] bg-white p-3"
          />
        ) : session.qrPayload ? (
          <p className="text-xs sr-muted break-all max-w-sm font-mono">{session.qrPayload}</p>
        ) : null}
        <p className="text-sm sr-muted max-w-md">
          Open any Malaysian banking app, choose DuitNow QR, and scan this code. Payment
          confirmation may take a minute — keep this page open.
        </p>
        {poll.data?.settled ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Payment confirmed. Thank you!
          </p>
        ) : poll.isFetching ? (
          <p className="text-xs sr-muted">Checking payment status…</p>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Card>
  );
}
