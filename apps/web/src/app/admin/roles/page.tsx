'use client';

import { Card, EmptyState } from '@smartresidence/ui-web';
import { ROLE_LABEL, ROLE_PRIORITY } from '@smartresidence/shared-types';
import { ShieldCheck } from 'lucide-react';

export default function AdminRolesPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Roles & access</h1>
        <p className="sr-muted">
          Granular RBAC powered by CASL abilities. Owners can revoke any access they granted in a single tap from
          the mobile app — sessions are killed instantly via Redis.
        </p>
      </header>
      <Card>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4" /> Roles in this deployment
        </h3>
        <ul className="divide-y divide-[rgb(var(--sr-border))]">
          {(Object.keys(ROLE_LABEL) as Array<keyof typeof ROLE_LABEL>)
            .sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])
            .map((id) => (
              <li key={id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{ROLE_LABEL[id]}</div>
                  <div className="text-xs sr-muted">{id}</div>
                </div>
                <div className="text-xs sr-muted">priority {ROLE_PRIORITY[id]}</div>
              </li>
            ))}
        </ul>
      </Card>
      <EmptyState
        title="Per-user role assignment UI lands in v0.2"
        description="The API supports it now (see /api/auth and /api/audit) — wiring the management UI is the next milestone."
      />
    </div>
  );
}
