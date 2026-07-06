'use client';
import { PendingWalkInCard } from '@/components/pending-walk-in-card';
import { PillTabs } from '@/components/pill-tabs';
import { type UnitSearchItem, UnitSearchPicker } from '@/components/unit-search-picker';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { queryKeys, useGuardWalkInPolicy, useMyCondos } from '@smartresidence/api-client';
import {
  type Visitor,
  isValidMalaysiaPhone,
  isVisitorBlacklistError,
} from '@smartresidence/shared-types';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { useState } from 'react';

type Tab = 'unit' | 'office';

export default function GuardWalkInPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const walkInPolicy = useGuardWalkInPolicy(api);
  const requireOwnerApproval = walkInPolicy.data?.walkInRequireOwnerApproval ?? true;
  const approvalMinutes = walkInPolicy.data?.walkInApprovalMinutes ?? 15;
  const [tab, setTab] = useState<Tab>('unit');
  const [unit, setUnit] = useState<UnitSearchItem | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingVisitor, setPendingVisitor] = useState<
    (Visitor & { unit?: { identifier?: string } }) | null
  >(null);
  const [blacklistAlert, setBlacklistAlert] = useState<string | null>(null);

  const pendingWalkIns = useQuery({
    queryKey: condo ? [...queryKeys.condoVisitors(condo.id), 'pending-walk-in'] : ['pending'],
    queryFn: () =>
      condo
        ? api.visitorsForCondo(condo.id, { status: 'PENDING_OWNER_APPROVAL', limit: 20 })
        : Promise.resolve({ items: [], total: 0 }),
    refetchInterval: 15_000,
    enabled: Boolean(condo && requireOwnerApproval),
  });

  function validatePhone(): boolean {
    if (!phone.trim()) {
      toast.error(t('visitors.guard.phoneRequiredError'));
      return false;
    }
    if (!isValidMalaysiaPhone(phone)) {
      toast.error(t('visitors.guard.phoneInvalid'));
      return false;
    }
    return true;
  }

  async function submitUnit() {
    if (!unit?.id || !name.trim()) {
      toast.error(t('visitors.guard.unitRequired'));
      return;
    }
    if (!validatePhone()) return;
    setBusy(true);
    setBlacklistAlert(null);
    try {
      const visitor = await api.createWalkInUnit({
        unitId: unit.id,
        name: name.trim(),
        phone: phone.trim(),
        purpose: purpose.trim() || undefined,
      });
      if (visitor.status === 'CHECKED_IN') {
        toast.success(t('visitors.guard.unitCheckedIn', { name: name.trim() }));
        setPendingVisitor(null);
      } else {
        toast.success(t('visitors.guard.sentForApproval', { minutes: approvalMinutes }));
        setPendingVisitor(visitor as Visitor & { unit?: { identifier?: string } });
      }
      setName('');
      setPhone('');
      setPurpose('');
      setUnit(null);
      pendingWalkIns.refetch();
    } catch (err) {
      const message = (err as Error).message;
      if (isVisitorBlacklistError(message)) {
        setBlacklistAlert(message);
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function submitOffice() {
    if (!name.trim() || !purpose.trim()) {
      toast.error(t('visitors.guard.purposeRequired'));
      return;
    }
    if (!validatePhone()) return;
    setBusy(true);
    setBlacklistAlert(null);
    try {
      await api.createWalkInOffice({
        name: name.trim(),
        phone: phone.trim(),
        purpose: purpose.trim(),
        gateLocation: 'Management office',
      });
      toast.success(t('visitors.guard.officeLogged', { name: name.trim() }));
      setName('');
      setPhone('');
      setPurpose('');
      setPendingVisitor(null);
    } catch (err) {
      const message = (err as Error).message;
      if (isVisitorBlacklistError(message)) {
        setBlacklistAlert(message);
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const tabItems = [
    { id: 'unit' as const, label: t('visitors.guard.tabUnit') },
    { id: 'office' as const, label: t('visitors.guard.tabOffice') },
  ];

  const pendingItems = (pendingWalkIns.data?.items ?? []) as Array<
    Visitor & { unit?: { identifier?: string } }
  >;

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('visitors.guard.walkInTitle')}</h1>
        {condo ? <p className="sr-muted text-sm mt-1">{condo.name}</p> : null}
        <p className="sr-muted text-sm mt-2">{t('visitors.guard.walkInBlurb')}</p>
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

      {pendingVisitor?.status === 'PENDING_OWNER_APPROVAL' ? (
        <PendingWalkInCard
          visitor={pendingVisitor}
          approvalMinutes={approvalMinutes}
          onResolved={() => {
            setPendingVisitor(null);
            pendingWalkIns.refetch();
          }}
        />
      ) : null}

      <PillTabs
        items={tabItems}
        value={tab}
        onChange={setTab}
        ariaLabel={t('visitors.guard.walkInTypeAria')}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="visitor-name">{t('visitors.guard.visitorName')}</Label>
          <Input
            id="visitor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('visitors.guard.fullName')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="visitor-phone">{t('visitors.guard.phoneRequired')}</Label>
          <Input
            id="visitor-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+60…"
            inputMode="tel"
            required
          />
        </div>

        {tab === 'unit' ? (
          <>
            <UnitSearchPicker
              condoId={condo?.id}
              value={unit}
              onChange={setUnit}
              label={t('visitors.guard.unitLabel')}
              placeholder={t('visitors.guard.unitSearch')}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purpose">{t('visitors.guard.purposeOptional')}</Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder={t('visitors.guard.purposePlaceholder')}
              />
            </div>
            <Button onClick={submitUnit} disabled={busy}>
              {busy
                ? t('visitors.guard.sending')
                : requireOwnerApproval
                  ? t('visitors.guard.requestApproval')
                  : t('visitors.guard.logAndCheckIn')}
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="office-purpose">{t('visitors.guard.purposeRequiredLabel')}</Label>
              <Input
                id="office-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder={t('visitors.guard.officePurposePlaceholder')}
              />
            </div>
            <Button onClick={submitOffice} disabled={busy}>
              {busy ? t('visitors.guard.logging') : t('visitors.guard.logAndCheckIn')}
            </Button>
          </>
        )}
      </Card>

      {requireOwnerApproval && pendingItems.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t('visitors.guard.pendingWalkIns')}</h2>
          {pendingItems.map((v) => (
            <PendingWalkInCard
              key={v.id}
              visitor={v}
              approvalMinutes={approvalMinutes}
              onResolved={() => pendingWalkIns.refetch()}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
