'use client';

import { PillTabs } from '@/components/pill-tabs';
import { type UnitSearchItem, UnitSearchPicker } from '@/components/unit-search-picker';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { useMyCondos } from '@smartresidence/api-client';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'unit' | 'office';

export default function GuardWalkInPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [tab, setTab] = useState<Tab>('unit');
  const [unit, setUnit] = useState<UnitSearchItem | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitUnit() {
    if (!unit?.id || !name.trim()) {
      toast.error(t('visitors.guard.unitRequired'));
      return;
    }
    setBusy(true);
    try {
      await api.createWalkInUnit({
        unitId: unit.id,
        name: name.trim(),
        phone: phone.trim() || undefined,
        purpose: purpose.trim() || undefined,
      });
      toast.success(t('visitors.guard.sentForApproval'));
      setName('');
      setPhone('');
      setPurpose('');
      setUnit(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitOffice() {
    if (!name.trim() || !purpose.trim()) {
      toast.error(t('visitors.guard.purposeRequired'));
      return;
    }
    setBusy(true);
    try {
      await api.createWalkInOffice({
        name: name.trim(),
        phone: phone.trim() || undefined,
        purpose: purpose.trim(),
        gateLocation: 'Management office',
      });
      toast.success(t('visitors.guard.officeLogged', { name: name.trim() }));
      setName('');
      setPhone('');
      setPurpose('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabItems = [
    { id: 'unit' as const, label: t('visitors.guard.tabUnit') },
    { id: 'office' as const, label: t('visitors.guard.tabOffice') },
  ];

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('visitors.guard.walkInTitle')}</h1>
        {condo ? <p className="sr-muted text-sm mt-1">{condo.name}</p> : null}
        <p className="sr-muted text-sm mt-2">{t('visitors.guard.walkInBlurb')}</p>
      </header>

      <PillTabs items={tabItems} value={tab} onChange={setTab} ariaLabel="Walk-in type" />

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
          <Label htmlFor="visitor-phone">{t('visitors.guard.phoneOptional')}</Label>
          <Input
            id="visitor-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+60…"
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
              {busy ? t('visitors.guard.sending') : t('visitors.guard.requestApproval')}
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
    </div>
  );
}
