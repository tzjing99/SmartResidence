'use client';

import { CallVisitorButton } from '@/components/call-visitor-button';
import { WalkInContactPanel } from '@/components/walk-in-contact-panel';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { formatTimeOnSite } from '@/lib/format-time-on-site';
import { toast } from '@/lib/toast';
import { useCheckOutVisitor } from '@smartresidence/api-client';
import { type GuardLiveVisitor, guardCanCheckOutVisitor } from '@smartresidence/shared-types';
import { Badge, Button, Card, Dialog, iosSpring } from '@smartresidence/ui-web';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, X } from 'lucide-react';
import * as React from 'react';

const MotionDialog = motion.create('dialog');

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
  const reduceMotion = useReducedMotion();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (confirmOpen) {
        setConfirmOpen(false);
      } else {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen, onClose]);

  const overlayTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] };
  const panelTransition = reduceMotion ? { duration: 0 } : iosSpring.snappy;

  const duration = formatTimeOnSite(new Date(visitor.checkedInAt));
  const canCheckOut = visitor.canCheckOut ?? guardCanCheckOutVisitor(visitor);

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
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={overlayTransition}
      >
        <button
          type="button"
          aria-label={t('visitors.guard.closeDetail')}
          className="absolute inset-0 bg-black/45 backdrop-blur-md"
          onClick={onClose}
        />

        <MotionDialog
          open
          aria-labelledby="guard-live-detail-title"
          className="relative z-10 m-0 flex w-full max-w-lg max-h-[min(90dvh,720px)] flex-col border-0 bg-transparent p-0 shadow-none"
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 10 }}
          transition={panelTransition}
        >
          <Card className="flex max-h-[min(90dvh,720px)] flex-col overflow-hidden rounded-2xl p-0 shadow-2xl ring-1 ring-black/5">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgb(var(--sr-border))] px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide sr-muted">
                  {t('visitors.guard.detailTitle')}
                </p>
                <h2
                  id="guard-live-detail-title"
                  className="text-xl font-bold tracking-tight truncate"
                >
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
                className="shrink-0"
              >
                <X className="size-4" />
              </Button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
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
                  <p className="text-sm leading-relaxed">{visitor.purpose}</p>
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
                <WalkInContactPanel
                  visitorPhone={visitor.phone}
                  ownerContacts={visitor.ownerContacts}
                />
              )}
            </div>

            <footer className="shrink-0 border-t border-[rgb(var(--sr-border))] p-5">
              {canCheckOut ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setConfirmOpen(true)}
                  disabled={checkOut.isPending}
                >
                  <LogOut className="size-4" />
                  {t('visitors.guard.checkOut')}
                </Button>
              ) : (
                <p className="text-sm sr-muted text-center leading-relaxed">
                  Walk-in visit — record only. Closes automatically at end of day; no manual
                  checkout.
                </p>
              )}
            </footer>
          </Card>
        </MotionDialog>
      </motion.div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        labelledBy="guard-checkout-confirm-title"
        closeLabel={t('visitors.guard.checkOutConfirmNo')}
        className="max-w-sm"
        lockScroll={false}
        closeOnEscape={false}
      >
        <Card className="rounded-2xl p-0 shadow-2xl ring-1 ring-black/5">
          <div className="flex flex-col gap-4 p-5">
            <div>
              <h3
                id="guard-checkout-confirm-title"
                className="text-lg font-semibold tracking-tight"
              >
                {t('visitors.guard.checkOutConfirmTitle')}
              </h3>
              <p className="text-sm sr-muted mt-2 leading-relaxed">
                {t('visitors.guard.checkOutConfirmBody')}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                {t('visitors.guard.checkOutConfirmNo')}
              </Button>
              <Button onClick={() => void onConfirmCheckOut()} disabled={checkOut.isPending}>
                {t('visitors.guard.checkOutConfirmYes')}
              </Button>
            </div>
          </div>
        </Card>
      </Dialog>
    </>
  );
}
