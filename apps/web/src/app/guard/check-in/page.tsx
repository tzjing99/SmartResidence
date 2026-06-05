'use client';

import { api } from '@/lib/api';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { useState } from 'react';
import { toast } from 'sonner';

type VerifiedVisitor = {
  id: string;
  name: string;
  accessCode?: string | null;
  visitType?: string;
  entryMode?: 'WALK_IN' | 'DRIVE_IN';
  vehiclePlate?: string | null;
  unit?: { identifier?: string; block?: { name?: string } };
  status: string;
};

function unitLabel(v: VerifiedVisitor) {
  const block = v.unit?.block?.name;
  const unit = v.unit?.identifier;
  if (block && unit) return `${block} · ${unit}`;
  return unit ?? (v.visitType === 'WALKIN_OFFICE' ? 'Management office' : '—');
}

export default function GuardCheckInPage() {
  const [code, setCode] = useState('');
  const [visitor, setVisitor] = useState<VerifiedVisitor | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup() {
    if (!code.trim()) return;
    setBusy(true);
    setVisitor(null);
    try {
      const v = (await api.verifyVisitorPass(code.trim())) as VerifiedVisitor;
      setVisitor(v);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function allowEntry() {
    if (!visitor) return;
    setBusy(true);
    try {
      await api.checkInVisitor(code.trim(), { gateLocation: 'Main gate (web)' });
      toast.success(`${visitor.name} checked in`);
      setVisitor(null);
      setCode('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Check in visitor</h1>
        <p className="sr-muted text-sm mt-1">Enter access code or paste QR payload.</p>
      </header>

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
          {busy && !visitor ? 'Looking up…' : 'Look up pass'}
        </Button>
      </Card>

      {visitor ? (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="font-semibold text-lg">{visitor.name}</p>
            <p className="text-sm sr-muted">Unit: {unitLabel(visitor)}</p>
            {visitor.accessCode ? (
              <p className="font-mono text-xl font-bold tracking-widest mt-2">
                {visitor.accessCode}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {visitor.entryMode ? (
                <span className="inline-flex items-center rounded-full border border-[rgb(var(--sr-border))] px-2 py-0.5 text-xs font-medium">
                  {visitor.entryMode === 'DRIVE_IN' ? 'Drive in' : 'Walk in'}
                </span>
              ) : null}
              {visitor.entryMode === 'DRIVE_IN' && visitor.vehiclePlate ? (
                <span className="font-mono text-sm font-semibold">{visitor.vehiclePlate}</span>
              ) : null}
            </div>
            <p className="text-xs sr-muted mt-1 capitalize">
              {visitor.status.toLowerCase().replace(/_/g, ' ')}
            </p>
          </div>
          <Button onClick={allowEntry} disabled={busy || visitor.status !== 'APPROVED'}>
            Allow entry
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
