'use client';

import { AdminPageHeader } from '@/components/admin-ui';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useMyCondos,
  useResidentContact,
  useSetUnitType,
  useUnitTypes,
  useUpdateResidentContact,
} from '@smartresidence/api-client';
import { Button, Card, EmptyState, Input, Label, Select, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { Building2, Edit3, Eye } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

const NO_TYPE = '__none__';

export default function AdminUnitsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [search, setSearch] = React.useState('');
  const [selectedResident, setSelectedResident] = React.useState<{
    unitId: string;
    userId: string;
  } | null>(null);
  const unitTypes = useUnitTypes(api, condo?.id ?? null);
  const setUnitType = useSetUnitType(api);
  const contact = useResidentContact(
    api,
    selectedResident?.unitId ?? null,
    selectedResident?.userId ?? null,
  );
  const updateContact = useUpdateResidentContact(api);
  const [contactDraft, setContactDraft] = React.useState({ name: '', email: '', phone: '' });

  const units = useQuery({
    queryKey: ['admin', 'units', condo?.id, search],
    queryFn: () =>
      condo
        ? api.listUnits(condo.id, { search: search || undefined, limit: 100 })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  const typeOptions = [
    { value: NO_TYPE, label: 'No type' },
    ...(unitTypes.data ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];

  React.useEffect(() => {
    if (!contact.data) return;
    setContactDraft({
      name: contact.data.name,
      email: contact.data.email ?? '',
      phone: contact.data.phone ?? '',
    });
  }, [contact.data]);

  async function assignType(unitId: string, value: string) {
    if (!condo) return;
    try {
      await setUnitType.mutateAsync({
        condoId: condo.id,
        unitId,
        unitTypeId: value === NO_TYPE ? null : value,
      });
      toast.success('Unit type updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function saveResidentContact(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResident) return;
    try {
      await updateContact.mutateAsync({
        unitId: selectedResident.unitId,
        userId: selectedResident.userId,
        input: {
          name: contactDraft.name,
          email: contactDraft.email,
          phone: contactDraft.phone,
        },
      });
      toast.success('Resident contact updated');
      setSelectedResident(null);
      await units.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <AdminPageHeader
        eyebrow="People"
        icon={Building2}
        title="Residents & units"
        description="Browse units, assign types for billing, and update resident contact details."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm sr-muted">{units.data?.total ?? 0} units</p>
        <div className="flex items-center gap-3">
          {(unitTypes.data?.length ?? 0) === 0 ? (
            <Link
              href="/admin/settings/unit-types"
              className="text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
            >
              Set up unit types →
            </Link>
          ) : null}
          <div className="w-72">
            <Input
              placeholder="Search by unit number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {units.isLoading ? (
        <Skeleton className="h-96" />
      ) : (units.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No units" />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted bg-[rgb(var(--sr-bg))]">
              <tr>
                <th className="py-3 px-4">Unit</th>
                <th>Block</th>
                <th>Sqft</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>Status</th>
                <th className="pr-4">Unit type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {(units.data?.items as any[]).map((u) => {
                const owner = u.ownerships?.[0]?.user;
                return (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-medium">{u.identifier}</td>
                    <td>{u.block?.name ?? '—'}</td>
                    <td className="sr-muted">{u.sqft ?? '—'}</td>
                    <td>
                      {owner?.name ?? <span className="sr-muted">unassigned</span>}
                      {owner?.email ? (
                        <span className="block text-xs sr-muted">{owner.email}</span>
                      ) : null}
                    </td>
                    <td>
                      {owner ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedResident({ unitId: u.id, userId: owner.id })}
                        >
                          <Eye className="size-4" />
                          View / edit
                        </Button>
                      ) : (
                        <span className="sr-muted">—</span>
                      )}
                    </td>
                    <td className="sr-muted">{u.status.toLowerCase().replace('_', ' ')}</td>
                    <td className="pr-4 py-2">
                      <Select
                        value={u.unitTypeId ?? NO_TYPE}
                        onValueChange={(v) => assignType(u.id, v)}
                        options={typeOptions}
                        aria-label={`Unit type for ${u.identifier}`}
                        className="w-44"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {selectedResident ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setSelectedResident(null)}
          />
          <Card className="relative z-10 mt-10 w-full max-w-2xl border-[rgb(var(--sr-coral)/0.35)] shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Edit3 className="size-4 text-[rgb(var(--sr-coral))]" />
                  <h3 className="font-semibold">Resident contact details</h3>
                </div>
                <p className="text-sm sr-muted mt-1">
                  Opening this panel is recorded in Who viewed me for resident transparency.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedResident(null)}
              >
                Close
              </Button>
            </div>
            {contact.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <form
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                onSubmit={saveResidentContact}
              >
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="resident-name">Full name</Label>
                  <Input
                    id="resident-name"
                    value={contactDraft.name}
                    onChange={(e) => setContactDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resident-email">Email</Label>
                  <Input
                    id="resident-email"
                    type="email"
                    value={contactDraft.email}
                    onChange={(e) => setContactDraft((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resident-phone">Mobile phone</Label>
                  <Input
                    id="resident-phone"
                    value={contactDraft.phone}
                    placeholder="+60123456789"
                    onChange={(e) => setContactDraft((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 border-t border-[rgb(var(--sr-border))]/70 pt-3">
                  <Button type="button" variant="ghost" onClick={() => setSelectedResident(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={updateContact.isPending}>
                    Save resident
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
