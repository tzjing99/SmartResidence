'use client';

import { SettingsSubNav } from '@/components/settings-sub-nav';
import { api } from '@/lib/api';
import { type AbilityRule } from '@/lib/roles';
import { queryKeys, useMe } from '@smartresidence/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { SETTINGS_NAV } from './settings-nav';

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const me = useMe(api);
  const pathname = usePathname();
  const cached = qc.getQueryData(queryKeys.me) as { abilities?: AbilityRule[] } | undefined;
  const abilities = (cached?.abilities ??
    (me.data as { abilities?: AbilityRule[] } | undefined)?.abilities ??
    []) as AbilityRule[];

  // The landing hub renders its own header + category cards, so the horizontal
  // sub-nav would be redundant there. Keep it on every sub-page.
  const isIndex = pathname === '/admin/settings';

  return (
    <div>
      {isIndex ? null : <SettingsSubNav items={SETTINGS_NAV} abilities={abilities} />}
      {children}
    </div>
  );
}
