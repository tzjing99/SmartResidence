'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { RecurringPassVerify } from '@smartresidence/shared-types';
import {
  deliveryPlatformLabel,
  guardVisitorStatusLabel,
  isQuickEntryPass,
  isVisitorBlacklistError,
  passKindLabel,
} from '@smartresidence/shared-types';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { Ban } from 'lucide-react';
import { useState } from 'react';

type VerifiedVisitor = {
  passType?: 'visitor';
  id: string;
  name: string;
  accessCode?: string | null;
  visitType?: string;
  passKind?: 'STANDARD' | 'DELIVERY' | 'E_HAILING';
  deliveryPlatform?: string | null;
  entryMode?: 'WALK_IN' | 'DRIVE_IN';
  vehiclePlate?: string | null;
  unit?: { identifier?: string; block?: { name?: string } };
  status: string;
};

type VerifiedPass = VerifiedVisitor | (RecurringPassVerify & { name?: string });

function unitLabel(v: VerifiedPass, t: ReturnType<typeof useT>) {
  if ('passType' in v && v.passType === 'recurring') {
    return v.unitLabel ?? '—';
  }
  const visitor = v as VerifiedVisitor;
  const block = visitor.unit?.block?.name;
  const unit = visitor.unit?.identifier;
  if (block && unit) return `${block} · ${unit}`;
  if (unit) return unit;
  if (visitor.visitType === 'WALKIN_OFFICE') return t('visitors.guard.managementOffice');
  return '—';
}

function displayName(v: VerifiedPass): string {
  if ('passType' in v && v.passType === 'recurring') return v.guestName;
  return (v as VerifiedVisitor).name;
}

export default function GuardCheckInPage() {
  const t = useT();
  const [code, setCode] = useState('');
  const [pass, setPass] = useState<VerifiedPass | null>(null);
  const [busy, setBusy] = useState(false);
  const [blacklistAlert, setBlacklistAlert] = useState<string | null>(null);

  async function lookup() {
    if (!code.trim()) return;
    setBusy(true);
    setPass(null);
    setBlacklistAlert(null);
    try {
      const v = (await api.verifyVisitorPass(code.trim())) as VerifiedVisitor;
      setPass({ ...v, passType: 'visitor' });
    } catch (visitorErr) {
      const visitorMessage = (visitorErr as Error).message;
      if (isVisitorBlacklistError(visitorMessage)) {
        setBlacklistAlert(visitorMessage);
        toast.error(visitorMessage);
        return;
      }
      try {
        const recurring = await api.verifyRecurringPass(code.trim());
        setPass(recurring);
      } catch (recurringErr) {
        toast.error((recurringErr as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function allowEntry() {
    if (!pass) return;
    setBusy(true);
    setBlacklistAlert(null);
    try {
      if ('passType' in pass && pass.passType === 'recurring') {
        if (!pass.withinSchedule) {
          toast.error(pass.scheduleMessage ?? t('visitors.guard.outsideSchedule'));
          return;
        }
        await api.checkInRecurringPass(code.trim(), { gateLocation: 'Main gate (web)' });
      } else {
        await api.checkInVisitor(code.trim(), { gateLocation: 'Main gate (web)' });
      }
      toast.success(t('visitors.guard.checkedInToast', { name: displayName(pass) }));
      setPass(null);
      setCode('');
    } catch (err) {
      const message = (err as Error).message;
      if (isVisitorBlacklistError(message)) setBlacklistAlert(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const isRecurring = pass && 'passType' in pass && pass.passType === 'recurring';
  const canCheckIn =
    pass && (isRecurring ? pass.withinSchedule : (pass as VerifiedVisitor).status === 'APPROVED');

  return (
    <div className="max-w-md flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('visitors.guard.checkInTitle')}</h1>
        <p className="sr-muted text-sm mt-1">{t('visitors.guard.checkInBlurb')}</p>
      </header>

      {blacklistAlert ? (
        <Card className="border-red-500/40 bg-red-500/5 p-4 flex gap-3 items-start">
          <Ban className="size-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">{t('visitors.guard.blockedTitle')}</p>
            <p className="text-sm text-red-700/90 mt-1">{blacklistAlert}</p>
          </div>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pass">{t('visitors.guard.accessCodeLabel')}</Label>
          <Input
            id="pass"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('visitors.guard.accessCodePlaceholder')}
            autoCapitalize="characters"
          />
        </div>
        <Button onClick={lookup} disabled={busy || !code.trim()}>
          {busy && !pass ? t('visitors.guard.lookingUp') : t('visitors.guard.lookUpPass')}
        </Button>
      </Card>

      {pass ? (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="font-semibold text-lg">{displayName(pass)}</p>
            {!isRecurring && isQuickEntryPass(pass as VerifiedVisitor) ? (
              <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-800 mt-1">
                {(() => {
                  const v = pass as VerifiedVisitor;
                  return v.deliveryPlatform
                    ? deliveryPlatformLabel(v.deliveryPlatform)
                    : passKindLabel(v.passKind ?? 'DELIVERY');
                })()}
              </span>
            ) : null}
            <p className="text-sm sr-muted">{t('visitors.guard.unitPrefix', { unit: unitLabel(pass, t) })}</p>
            {isRecurring ? (
              <p className="text-xs sr-muted mt-1">
                {t('visitors.guard.recurringPassMeta', { message: pass.scheduleMessage ?? t('visitors.guard.withinSchedule') })}
              </p>
            ) : null}
            {pass.accessCode ? (
              <p className="font-mono text-xl font-bold tracking-widest mt-2">{pass.accessCode}</p>
            ) : null}
            {!isRecurring && (pass as VerifiedVisitor).entryMode ? (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center rounded-full border border-[rgb(var(--sr-border))] px-2 py-0.5 text-xs font-medium">
                  {(pass as VerifiedVisitor).entryMode === 'DRIVE_IN' ? t('visitors.guard.driveIn') : t('visitors.guard.walkInEntry')}
                </span>
                {(pass as VerifiedVisitor).entryMode === 'DRIVE_IN' &&
                (pass as VerifiedVisitor).vehiclePlate ? (
                  <span className="font-mono text-sm font-semibold">
                    {(pass as VerifiedVisitor).vehiclePlate}
                  </span>
                ) : null}
              </div>
            ) : null}
            {!isRecurring ? (
              <p className="text-xs sr-muted mt-1">
                {guardVisitorStatusLabel((pass as VerifiedVisitor).status)}
              </p>
            ) : null}
          </div>
          <Button onClick={allowEntry} disabled={busy || !canCheckIn}>
            {t('visitors.guard.allowEntry')}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
