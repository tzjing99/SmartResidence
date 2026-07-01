'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useEInvoiceConfig,
  useMyCondos,
  useUpdateEInvoiceConfig,
} from '@smartresidence/api-client';
import type { EInvoiceConfig, EInvoiceEnvironment } from '@smartresidence/shared-types';
import { DEFAULT_EINVOICE_CONFIG, EINVOICE_TAX_TYPE_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Building2, FileCheck2, KeyRound, MapPin } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

function SettingsSection({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: typeof FileCheck2;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-start gap-4 border-b border-[rgb(var(--sr-border))]/70 p-5 sm:p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]">
          <Icon className="size-5 text-[rgb(var(--sr-coral))]" />
        </span>
        <div>
          <div className="text-xs uppercase tracking-wide sr-muted font-semibold">{eyebrow}</div>
          <h3 className="text-lg font-semibold mt-1">{title}</h3>
          <p className="text-sm sr-muted mt-1 max-w-3xl">{description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </Card>
  );
}

type TextField = { key: keyof EInvoiceConfig; label: string; placeholder?: string; help?: string };

const SUPPLIER_FIELDS: TextField[] = [
  { key: 'supplierTin', label: 'Supplier TIN', placeholder: 'C1234567890' },
  { key: 'supplierName', label: 'Legal / JMB name', placeholder: 'Sunrise Residence JMB' },
  { key: 'registrationNo', label: 'Business registration no. (SSM)', placeholder: '202301012345' },
  { key: 'sstRegistrationNo', label: 'SST registration no.', placeholder: 'NA' },
  {
    key: 'msicCode',
    label: 'MSIC business code',
    placeholder: '68200',
    help: '5-digit MSIC 2008 code',
  },
  {
    key: 'businessActivityDescription',
    label: 'Business activity',
    placeholder: 'Real estate management services',
  },
  { key: 'supplierEmail', label: 'Email', placeholder: 'billing@residence.my' },
  { key: 'supplierPhone', label: 'Phone', placeholder: '+60312345678' },
];

const ADDRESS_FIELDS: TextField[] = [
  { key: 'addressLine1', label: 'Address line 1', placeholder: 'Level 1, Management Office' },
  { key: 'addressLine2', label: 'Address line 2', placeholder: 'Jalan Contoh 1' },
  { key: 'city', label: 'City', placeholder: 'Kuala Lumpur' },
  { key: 'postcode', label: 'Postcode', placeholder: '50000' },
  {
    key: 'state',
    label: 'State code',
    placeholder: '14',
    help: 'LHDN state code, e.g. 14 = WP KL',
  },
  { key: 'countryCode', label: 'Country code', placeholder: 'MYS' },
];

function EInvoiceForm({ condoId }: { condoId: string }) {
  const config = useEInvoiceConfig(api, condoId);
  const update = useUpdateEInvoiceConfig(api);
  const [draft, setDraft] = React.useState<EInvoiceConfig>(DEFAULT_EINVOICE_CONFIG);
  const [clientId, setClientId] = React.useState('');
  const [clientSecret, setClientSecret] = React.useState('');
  const secretConfigured = config.data?.secretConfigured ?? false;

  React.useEffect(() => {
    if (config.data) {
      const { secretConfigured: _s, updatedAt: _u, ...rest } = config.data;
      setDraft(rest);
    }
  }, [config.data]);

  function setField(key: keyof EInvoiceConfig, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        condoId,
        input: {
          ...draft,
          apiClientId: clientId.trim() || undefined,
          apiClientSecret: clientSecret.trim() || undefined,
        },
      });
      setClientId('');
      setClientSecret('');
      toast.success('E-invoicing settings saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (config.isLoading) return <Skeleton className="h-96" />;

  return (
    <form className="flex flex-col gap-6" onSubmit={save}>
      <SettingsSection
        icon={FileCheck2}
        eyebrow="LHDN MyInvois"
        title="Submission mode"
        description="Enable e-invoicing to produce Malaysian e-invoices for issued invoices. Choose Sandbox for local integration testing, or Production to submit to the live LHDN MyInvois API."
      >
        <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))] p-4 text-sm space-y-2">
          <p>
            <span className="font-medium">Sandbox</span> validates documents locally with no LHDN
            network call. Use this while configuring supplier details and testing invoice flows. API
            credentials are optional.
          </p>
          <p>
            <span className="font-medium">Production</span> submits invoices to LHDN via OAuth2 and
            the MyInvois document API. Requires LHDN-issued client id and secret (stored encrypted
            below), plus complete supplier TIN, MSIC code, and address. Without credentials,
            Production falls back to Sandbox so misconfiguration does not hit the live API.
          </p>
        </div>
        <div className="flex flex-col gap-4 mt-4">
          <label className="inline-flex items-start gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="mt-0.5 size-4 rounded border-[rgb(var(--sr-border))]"
            />
            <span>
              <span className="block font-medium">Enable LHDN e-invoicing</span>
              <span className="block text-xs sr-muted">
                Required to submit invoices to MyInvois for validation.
              </span>
            </span>
          </label>
          <label className="inline-flex items-start gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.autoSubmitOnIssue}
              onChange={(e) => setDraft({ ...draft, autoSubmitOnIssue: e.target.checked })}
              className="mt-0.5 size-4 rounded border-[rgb(var(--sr-border))]"
            />
            <span>
              <span className="block font-medium">Auto-submit when an invoice is issued</span>
              <span className="block text-xs sr-muted">
                Otherwise a draft e-invoice is created and you submit it manually.
              </span>
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ei-env">Environment</Label>
              <select
                id="ei-env"
                className={selectCls}
                value={draft.environment}
                onChange={(e) =>
                  setDraft({ ...draft, environment: e.target.value as EInvoiceEnvironment })
                }
              >
                <option value="SANDBOX">Sandbox (local validation, no LHDN call)</option>
                <option value="PRODUCTION">Production (live LHDN MyInvois API)</option>
              </select>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Building2}
        eyebrow="Supplier"
        title="Supplier identification"
        description="Details LHDN requires for the supplier (your management corporation / JMB). TIN and MSIC code are mandatory for validation."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SUPPLIER_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`ei-${field.key}`}>{field.label}</Label>
              <Input
                id={`ei-${field.key}`}
                value={draft[field.key] as string}
                placeholder={field.placeholder}
                onChange={(e) => setField(field.key, e.target.value)}
              />
              {field.help ? <p className="text-xs sr-muted">{field.help}</p> : null}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={MapPin}
        eyebrow="Address & tax"
        title="Supplier address and default tax"
        description="Registered address and the default tax treatment applied to invoice lines. Malaysian maintenance charges are commonly Not Applicable (06)."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADDRESS_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`ei-${field.key}`}>{field.label}</Label>
              <Input
                id={`ei-${field.key}`}
                value={draft[field.key] as string}
                placeholder={field.placeholder}
                onChange={(e) => setField(field.key, e.target.value)}
              />
              {field.help ? <p className="text-xs sr-muted">{field.help}</p> : null}
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ei-taxtype">Default tax type</Label>
            <select
              id="ei-taxtype"
              className={selectCls}
              value={draft.defaultTaxType}
              onChange={(e) => setDraft({ ...draft, defaultTaxType: e.target.value })}
            >
              {Object.entries(EINVOICE_TAX_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {value} — {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ei-taxrate">Default tax rate (%)</Label>
            <Input
              id="ei-taxrate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={String(draft.defaultTaxRate ?? 0)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultTaxRate: e.target.value === '' ? 0 : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={KeyRound}
        eyebrow="Credentials"
        title="LHDN API credentials"
        description="Client id and secret from the LHDN MyInvois portal (Taxpayer or Intermediary system registration). Encrypted at rest and never shown again. Required before Production submissions; optional for Sandbox."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="ei-client-id">Client ID</Label>
              {secretConfigured ? <Badge tone="success">Stored</Badge> : null}
            </div>
            <Input
              id="ei-client-id"
              type="password"
              autoComplete="off"
              placeholder={secretConfigured ? '•••••••• (stored)' : ''}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ei-client-secret">Client secret</Label>
            <Input
              id="ei-client-secret"
              type="password"
              autoComplete="off"
              placeholder={secretConfigured ? '•••••••• (stored)' : ''}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminEInvoiceSettingsPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      <header className="rounded-3xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-6">
        <p className="text-sm sr-muted">Billing setup</p>
        <h2 className="text-3xl font-bold tracking-tight">E-invoicing (LHDN MyInvois)</h2>
        <p className="sr-muted mt-2 max-w-3xl">
          Produce Malaysian e-invoices for issued invoices, submit them to LHDN for validation, and
          store the returned identifiers, status and verification QR. Mandatory under the Malaysian
          e-invoice roll-out.
        </p>
      </header>

      {condoId ? <EInvoiceForm condoId={condoId} /> : <Skeleton className="h-96" />}
    </div>
  );
}
