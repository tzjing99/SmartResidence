'use client';

import { CallVisitorButton } from '@/components/call-visitor-button';
import { WalkInContactPanel } from '@/components/walk-in-contact-panel';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { formatTimeOnSite } from '@/lib/format-time-on-site';
import { toast } from '@/lib/toast';
import { useCheckOutVisitor } from '@smartresidence/api-client';
import type { GuardLiveVisitor } from '@smartresidence/shared-types';
import { Badge, Button } from '@smartresidence/ui-web';
import { LogOut, X } from 'lucide-react';
import * as React from 'react';

type GuardLiveVisitorDetailProps = {
  visitor: GuardLiveVisitor;
  onClose: () => void;
  onCheckedOut?: () => void;
};

function visitTypeLabel(
  visitType: GuardLiveVisitor['visitType'],
  t: ReturnType<typeof useT>,
): string {
  switch (visitType) {
    case 'PRE_REG':
      return t('visitors.guard.visitTypePreReg');
    case 'WALKIN_UNIT':
      return t('visitors.guard.visitTypeWalkInUnit');
    case 'WALKIN_OFFICE':
      return t('visitors.guard.visitTypeWalkInOffice');
    default:
      return visitType;
  }
}

export function GuardLiveVisitorDetail({
  visitor,
  onClose,
  onCheckedOut,
}: GuardLiveVisitorDetailProps) {
  const t = useT();
  const checkOut = useCheckOutVisitor(api);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const duration = formatTimeOnSite(new Date(visitor.checkedInAt));

  async function onConfirmCheckOut() {
    try {
      await checkOut.mutateAsync(visitor.id);
      toast.success(t('visitors.guard.checkOutSuccess', { name: visitor.name }));
      setConfirmOpen(false);
      onCheckedOut?.();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || t('visitors.guard.checkOutFailed'));
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('visitors.guard.closeDetail')}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <dialog
        open
        aria-labelledby="guard-live-detail-title"
        className="fixed inset-y-0 right-0 z-50 m-0 ml-auto w-full max-w-md flex flex-col border-l border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))] shadow-xl animate-in slide-in-from-right duration-200 p-0"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[rgb(var(--sr-border))] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide sr-muted">
              {t('visitors.guard.detailTitle')}
            </p>
            <h2 id="guard-live-detail-title" className="text-xl font-bold tracking-tight truncate">
              {visitor.name}
            </h2>
            <p className="text-sm sr-muted mt-0.5">
              {visitor.unitLabel ?? '—'} · {t('visitors.guard.timeOnSite', { duration })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('visitors.guard.closeDetail')}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{visitTypeLabel(visitor.visitType, t)}</Badge>
            {visitor.overnight ? (
              <Badge tone="warning">{t('visitors.guard.overnightBadge')}</Badge>
            ) : null}
            {visitor.vehiclePlate ? <Badge tone="neutral">{visitor.vehiclePlate}</Badge> : null}
          </div>

          {visitor.purpose ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide sr-muted mb-1">
                {t('visitors.guard.purposeLabel')}
              </p>
              <p className="text-sm">{visitor.purpose}</p>
            </div>
          ) : null}

          {visitor.visitType === 'WALKIN_OFFICE' ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-surface))] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide sr-muted">
                {t('visitors.guard.contactSection')}
              </p>
              <CallVisitorButton phone={visitor.phone} />
            </div>
          ) : (
            <WalkInContactPanel visitorPhone={visitor.phone} ownerContacts={visitor.ownerContacts} />
          )}
        </div>

        <footer className="border-t border-[rgb(var(--sr-border))] p-5">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setConfirmOpen(true)}
            disabled={checkOut.isPending}
          >
            <LogOut className="size-4" />
            {t('visitors.guard.checkOut')}
          </Button>
        </footer>
      </dialog>

      {confirmOpen ? (
        <>
          <button
            type="button"
            aria-label={t('visitors.guard.checkOutConfirmNo')}
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setConfirmOpen(false)}
          />
          <dialog
            open
            aria-labelledby="guard-checkout-confirm-title"
            className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))] p-0 shadow-xl"
          >
            <div className="p-5 flex flex-col gap-4">
              <div>
                <h3 id="guard-checkout-confirm-title" className="text-lg font-semibold">
                  {t('visitors.guard.checkOutConfirmTitle')}
                </h3>
                <p className="text-sm sr-muted mt-2">{t('visitors.guard.checkOutConfirmBody')}</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                  {t('visitors.guard.checkOutConfirmNo')}
                </Button>
                <Button onClick={() => void onConfirmCheckOut()} disabled={checkOut.isPending}>
                  {t('visitors.guard.checkOutConfirmYes')}
                </Button>
              </div>
            </div>
          </dialog>
        </>
      ) : null}
    </>
  );
}
