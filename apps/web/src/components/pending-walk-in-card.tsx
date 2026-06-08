'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useGuardApproveWalkIn } from '@smartresidence/api-client';
import type { GuardApprovalMethod, Visitor } from '@smartresidence/shared-types';
import { Badge, Button, Card } from '@smartresidence/ui-web';
import { Phone, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ResidentConfirmDialog } from './resident-confirm-dialog';
import { WalkInContactPanel } from './walk-in-contact-panel';

type PendingWalkInCardProps = {
  visitor: Visitor & { unit?: { identifier?: string } };
  approvalMinutes: number;
  onResolved?: () => void;
};

export function PendingWalkInCard({
  visitor,
  approvalMinutes,
  onResolved,
}: PendingWalkInCardProps) {
  const t = useT();
  const approve = useGuardApproveWalkIn(api);
  const [confirmManual, setConfirmManual] = useState(false);
  const deadline = visitor.approvalDeadline
    ? new Date(visitor.approvalDeadline).toLocaleTimeString()
    : null;

  async function runApprove(method: GuardApprovalMethod) {
    try {
      await approve.mutateAsync({ visitorId: visitor.id, method });
      toast.success(t('visitors.guard.approvedCheckedIn', { name: visitor.name }));
      setConfirmManual(false);
      onResolved?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{visitor.name}</p>
          <p className="text-sm sr-muted">
            {visitor.unit?.identifier ?? '—'}
            {deadline ? ` · ${t('visitors.guard.deadline', { time: deadline })}` : null}
          </p>
        </div>
        <Badge tone="warning">{t('visitors.guard.awaitingOwner')}</Badge>
      </div>
      <p className="text-sm sr-muted">
        {t('visitors.guard.waitingOwnerApproval', { minutes: approvalMinutes })}
      </p>
      <WalkInContactPanel
        visitorPhone={visitor.phone}
        visitorPhoneCountryCode={visitor.phoneCountryCode}
        ownerContacts={visitor.ownerContacts}
      />

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <Button
          variant="soft-sky"
          className="flex-1"
          onClick={() => runApprove('OWNER_BY_PHONE')}
          disabled={approve.isPending}
        >
          <Phone className="size-4" aria-hidden />
          {t('visitors.guard.ownerApprovedByPhone')}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setConfirmManual(true)}
          disabled={approve.isPending}
        >
          <ShieldCheck className="size-4" aria-hidden />
          {t('visitors.guard.approveVerified')}
        </Button>
      </div>
      <p className="text-xs sr-muted">{t('visitors.guard.guardApproveHint')}</p>

      <ResidentConfirmDialog
        open={confirmManual}
        title={t('visitors.guard.approveVerifiedConfirmTitle')}
        description={t('visitors.guard.approveVerifiedConfirmBody', { name: visitor.name })}
        confirmLabel={t('visitors.guard.approveVerifiedConfirmCta')}
        cancelLabel={t('visitors.guard.cancel')}
        confirmPending={approve.isPending}
        onConfirm={() => runApprove('GUARD_MANUAL')}
        onCancel={() => setConfirmManual(false)}
      />
    </Card>
  );
}
