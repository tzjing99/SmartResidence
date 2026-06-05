'use client';

import { type SettingsNavItem, SettingsSubNav } from '@/components/settings-sub-nav';
import { api } from '@/lib/api';
import { type AbilityRule } from '@/lib/roles';
import { useMe } from '@smartresidence/api-client';

const SETTINGS_NAV: SettingsNavItem[] = [
  { href: '/settings', label: 'Notifications' },
  {
    href: '/settings/sla-audit',
    label: 'Response time history',
    can: { action: 'read', subject: 'SlaPolicy' },
  },
];

export default function ResidentSettingsLayout({ children }: { children: React.ReactNode }) {
  const me = useMe(api);
  const abilities = ((me.data as { abilities?: AbilityRule[] } | undefined)?.abilities ??
    []) as AbilityRule[];

  return (
    <div>
      <SettingsSubNav items={SETTINGS_NAV} abilities={abilities} />
      {children}
    </div>
  );
}
