'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { RecurringPassVerify } from '@smartresidence/shared-types';
import { isVisitorBlacklistError } from '@smartresidence/shared-types';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { Ban } from 'lucide-react';
import { useState } from 'react';

type VerifiedVisitor = {
  passType?: 'visitor';
  id: string;
  name: string;
  accessCode?: string | null;
  visitType?: string;
  entryMode?: 'WALK_IN' | 'DRIVE_IN';
  vehiclePlate?: string | null;
  unit?: { identifier?: string; block?: { name?: string } };
  status: string;
};

type VerifiedPass = VerifiedVisitor | (RecurringPassVerify & { name?: string });

function unitLabel(v: VerifiedPass) {
  if ('passType' in v && v.passType === 'recurring') {
    return v.unitLabel ?? '—';
  }
  const visitor = v as VerifiedVisitor;
  const block = visitor.unit?.block?.name;
  const unit = visitor.unit?.identifier;
  if (block && unit) return `${block} · ${unit}`;
  return unit ?? (visitor.visitType === 'WALKIN_OFFICE' ? 'Management office' : '—');
}

function displayName(v: VerifiedPass): string {
  if ('passType' in v && v.passType === 'recurring') return v.guestName;
  return (v as VerifiedVisitor).name;
}

export default function GuardCheckInPage() {
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
          toast.error(pass.scheduleMessage ?? 'Outside recurring pass schedule');
          return;
        }
        await api.checkInRecurringPass(code.trim(), { gateLocation: 'Main gate (web)' });
      } else {
        await api.checkInVisitor(code.trim(), { gateLocation: 'Main gate (web)' });
      }
      toast.success(`${displayName(pass)} checked in`);
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
        <h1 className="text-2xl font-bold tracking-tight">Check in visitor</h1>
        <p className="sr-muted text-sm mt-1">
          Enter the visitor&apos;s access code or scan their QR code (one-off visit or weekly pass).
        </p>
      </header>

      {blacklistAlert ? (
        <Card className="border-red-500/40 bg-red-500/5 p-4 flex gap-3 items-start">
          <Ban className="size-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Visitor blocked</p>
            <p className="text-sm text-red-700/90 mt-1">{blacklistAlert}</p>
          </div>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pass">Access code / QR</Label>
          <Input
            id="pass"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7M3P9"
            autoCapitalize="characters"
          />
        </div>
        <Button onClick={lookup} disabled={busy || !code.trim()}>
          {busy && !pass ? 'Looking up…' : 'Look up pass'}
        </Button>
      </Card>

      {pass ? (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="font-semibold text-lg">{displayName(pass)}</p>
            <p className="text-sm sr-muted">Unit: {unitLabel(pass)}</p>
            {isRecurring ? (
              <p className="text-xs sr-muted mt-1">
                Recurring pass · {pass.scheduleMessage ?? 'Within schedule'}
              </p>
            ) : null}
            {pass.accessCode ? (
              <p className="font-mono text-xl font-bold tracking-widest mt-2">{pass.accessCode}</p>
            ) : null}
            {!isRecurring && (pass as VerifiedVisitor).entryMode ? (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center rounded-full border border-[rgb(var(--sr-border))] px-2 py-0.5 text-xs font-medium">
                  {(pass as VerifiedVisitor).entryMode === 'DRIVE_IN' ? 'Drive in' : 'Walk in'}
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
              <p className="text-xs sr-muted mt-1 capitalize">
                {(pass as VerifiedVisitor).status.toLowerCase().replace(/_/g, ' ')}
              </p>
            ) : null}
          </div>
          <Button onClick={allowEntry} disabled={busy || !canCheckIn}>
            Allow entry
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
