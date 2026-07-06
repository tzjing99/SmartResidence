'use client';

import { type SettingsNavItem, SettingsSubNav } from '@/components/settings-sub-nav';
import { api } from '@/lib/api';
import { type AbilityRule } from '@/lib/roles';
import { queryKeys, useMe } from '@smartresidence/api-client';
import { useQueryClient } from '@tanstack/react-query';

const SETTINGS_NAV: SettingsNavItem[] = [
  { href: '/settings', label: 'Profile & alerts' },
  { href: '/settings/sessions', label: 'Devices & sessions' },
  {
    href: '/settings/sla-audit',
    label: 'Response time history',
    can: { action: 'read', subject: 'SlaPolicy' },
  },
];

export default function ResidentSettingsLayout({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const me = useMe(api);
  const cached = qc.getQueryData(queryKeys.me) as { abilities?: AbilityRule[] } | undefined;
  const abilities = (cached?.abilities ??
    (me.data as { abilities?: AbilityRule[] } | undefined)?.abilities ??
    []) as AbilityRule[];

  return (
    <div>
      <SettingsSubNav items={SETTINGS_NAV} abilities={abilities} />
      {children}
    </div>
  );
}
