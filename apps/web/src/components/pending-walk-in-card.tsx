'use client';

import { useT } from '@/i18n/locale-provider';
import type { Visitor } from '@smartresidence/shared-types';
import { Badge, Card } from '@smartresidence/ui-web';
import { WalkInContactPanel } from './walk-in-contact-panel';

type PendingWalkInCardProps = {
  visitor: Visitor & { unit?: { identifier?: string } };
  approvalMinutes: number;
};

export function PendingWalkInCard({ visitor, approvalMinutes }: PendingWalkInCardProps) {
  const t = useT();
  const deadline = visitor.approvalDeadline
    ? new Date(visitor.approvalDeadline).toLocaleTimeString()
    : null;

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
      <WalkInContactPanel visitorPhone={visitor.phone} ownerContacts={visitor.ownerContacts} />
    </Card>
  );
}
