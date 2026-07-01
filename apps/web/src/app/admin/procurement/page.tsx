'use client';

import { AdminPageHeader } from '@/components/admin-ui';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useApproveVendorBill,
  useCondoVendorBills,
  useCondoVendors,
  useCreateVendor,
  useCreateVendorBill,
  useMyCondos,
  usePayVendorBill,
  useVoidVendorBill,
} from '@smartresidence/api-client';
import type { VendorBill, VendorBillFund, VendorBillStatus } from '@smartresidence/shared-types';
import { VENDOR_BILL_FUND_LABELS, VENDOR_BILL_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Receipt } from 'lucide-react';
import * as React from 'react';

const STATUS_TONE: Record<VendorBillStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  APPROVED: 'warning',
  PAID: 'success',
  VOID: 'danger',
};

const FUNDS: VendorBillFund[] = ['MAINTENANCE', 'SINKING_FUND', 'GENERAL'];

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function VendorList({ condoId }: { condoId: string }) {
  const vendors = useCondoVendors(api, condoId, { activeOnly: true });
  const createVendor = useCreateVendor(api);
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createVendor.mutateAsync({
        condoId,
        name: name.trim(),
        contact: contact.trim() || undefined,
      });
      toast.success('Vendor added');
      setName('');
      setContact('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const items = vendors.data?.items ?? [];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Vendors</h2>
      <Card className="p-4 space-y-3">
        <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="vendor-contact">Contact</Label>
            <Input
              id="vendor-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone / email"
            />
          </div>
          <Button type="submit" loading={createVendor.isPending}>
            Add vendor
          </Button>
        </form>
      </Card>
      {vendors.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-8" />}
          title="No vendors yet"
          description="Add your suppliers above — then you can record and pay their invoices."
        />
      ) : (
        <ul className="grid gap-2">
          {items.map((v) => (
            <li key={v.id} className="flex justify-between rounded-lg border px-4 py-3 text-sm">
              <span className="font-medium">{v.name}</span>
              <span className="sr-muted">{v.contact ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BillQueue({ condoId }: { condoId: string }) {
  const [statusFilter, setStatusFilter] = React.useState<string>('DRAFT');
  const vendors = useCondoVendors(api, condoId, { activeOnly: true });
  const bills = useCondoVendorBills(api, condoId, {
    status: statusFilter || undefined,
  });
  const createBill = useCreateVendorBill(api);
  const approve = useApproveVendorBill(api);
  const pay = usePayVendorBill(api);
  const voidBill = useVoidVendorBill(api);

  const [vendorId, setVendorId] = React.useState('');
  const [billNumber, setBillNumber] = React.useState('');
  const [billDate, setBillDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [fund, setFund] = React.useState<VendorBillFund>('MAINTENANCE');
  const [description, setDescription] = React.useState('');

  const [reportFrom, setReportFrom] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [reportTo, setReportTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = React.useState(false);

  const items = (bills.data?.items ?? []) as VendorBill[];

  const submitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !billNumber.trim() || !amount) return;
    try {
      await createBill.mutateAsync({
        condoId,
        vendorId,
        billNumber: billNumber.trim(),
        billDate,
        dueDate: dueDate || billDate,
        amount: Number.parseFloat(amount),
        fund,
        description: description.trim() || undefined,
      });
      toast.success('Bill saved as draft');
      setBillNumber('');
      setAmount('');
      setDescription('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const doApprove = async (id: string) => {
    if (!window.confirm('Approve this vendor bill?')) return;
    try {
      await approve.mutateAsync(id);
      toast.success('Bill approved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const doPay = async (id: string) => {
    if (!window.confirm('Record manual payment for this bill?')) return;
    try {
      await pay.mutateAsync(id);
      toast.success('Bill marked paid');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const doVoid = async (id: string) => {
    if (!window.confirm('Void this bill?')) return;
    try {
      await voidBill.mutateAsync(id);
      toast.success('Bill voided');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.downloadVendorSpendCsv(condoId, {
        from: reportFrom,
        to: reportTo,
      });
      await downloadBlob(blob, `vendor-spend-${reportFrom}-${reportTo}.csv`);
      toast.success('AGM spend report downloaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Vendor bills</h2>
        <select
          className="sr-select w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="DRAFT">Drafts</option>
          <option value="APPROVED">Approved (awaiting payment)</option>
          <option value="PAID">Paid</option>
          <option value="VOID">Void</option>
          <option value="">All</option>
        </select>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-medium">New bill</h3>
        <form onSubmit={submitBill} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>Vendor</Label>
            <select
              className="sr-select w-full"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
            >
              <option value="">Select vendor</option>
              {(vendors.data?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Bill number</Label>
            <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} required />
          </div>
          <div>
            <Label>Amount (MYR)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Bill date</Label>
            <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Fund</Label>
            <select
              className="sr-select w-full"
              value={fund}
              onChange={(e) => setFund(e.target.value as VendorBillFund)}
            >
              {FUNDS.map((f) => (
                <option key={f} value={f}>
                  {VENDOR_BILL_FUND_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Work performed, invoice reference…"
            />
          </div>
          <div>
            <Button type="submit" loading={createBill.isPending}>
              Save draft
            </Button>
          </div>
        </form>
      </Card>

      {bills.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No bills"
          description="Draft vendor invoices appear here for approval."
        />
      ) : (
        <div className="grid gap-4">
          {items.map((b) => (
            <Card key={b.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {b.billNumber} · {b.vendor?.name ?? 'Vendor'}
                  </div>
                  <div className="text-sm sr-muted">
                    {VENDOR_BILL_FUND_LABELS[b.fund]} · MYR {fmtMoney(b.amount)} · Due{' '}
                    {fmtDate(b.dueDate)}
                  </div>
                  {b.description ? <p className="text-sm mt-1">{b.description}</p> : null}
                </div>
                <Badge tone={STATUS_TONE[b.status]}>{VENDOR_BILL_STATUS_LABELS[b.status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {b.status === 'DRAFT' ? (
                  <>
                    <Button size="sm" onClick={() => doApprove(b.id)} disabled={approve.isPending}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => doVoid(b.id)}
                      disabled={voidBill.isPending}
                    >
                      Void
                    </Button>
                  </>
                ) : null}
                {b.status === 'APPROVED' ? (
                  <>
                    <Button size="sm" onClick={() => doPay(b.id)} disabled={pay.isPending}>
                      Mark paid
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => doVoid(b.id)}
                      disabled={voidBill.isPending}
                    >
                      Void
                    </Button>
                  </>
                ) : null}
                {b.status === 'PAID' && b.paidAt ? (
                  <span className="text-sm sr-muted">Paid {fmtDate(b.paidAt)}</span>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 space-y-3">
        <h3 className="font-medium">AGM vendor spend report</h3>
        <p className="text-sm sr-muted">
          Paid bills grouped by maintenance, sinking fund, and general — for audit and AGM
          disclosure.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>From</Label>
            <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={exportCsv} loading={exporting}>
            Download CSV
          </Button>
        </div>
      </Card>
    </section>
  );
}

export default function ProcurementPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;

  if (condos.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!condoId) {
    return (
      <EmptyState
        icon={<Receipt className="size-8" />}
        title="No condo selected"
        description="Select a condo to manage vendor bills."
      />
    );
  }

  return (
    <div className="space-y-10 max-w-4xl">
      <AdminPageHeader
        eyebrow="Money"
        title="Procurement"
        description="Track vendor invoices and payments — useful for JMB audits and AGM reporting."
      />
      <VendorList condoId={condoId} />
      <BillQueue condoId={condoId} />
    </div>
  );
}
