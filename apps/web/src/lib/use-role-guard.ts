'use client';

import { api } from '@/lib/api';
import { type Area, type MeResponse, areaAllows, roleToHome } from '@/lib/roles';
import { useMe } from '@smartresidence/api-client';
import type { RoleId } from '@smartresidence/shared-types';
import { useRouter } from 'next/navigation';
import * as React from 'react';

interface RoleGuardResult {
  me: ReturnType<typeof useMe>;
  role: RoleId | null;
  abilities: MeResponse['abilities'] | undefined;
  /** True once `/api/auth/me` resolved AND the user's role is allowed in this area. */
  ready: boolean;
}

/**
 * Drives navigation and route protection from the user's `activeRole`.
 *
 * - If `/api/auth/me` errors (no/expired session) → redirect to /sign-in.
 * - If the user's role doesn't belong in this area → redirect to their home
 *   (residents bounced out of /admin, management out of resident pages, etc.).
 * - Returns `ready: false` while loading or redirecting so shells can render a
 *   neutral loading state instead of flashing the wrong navigation.
 */
export function useRoleGuard(area: Area): RoleGuardResult {
  const router = useRouter();
  const me = useMe(api);
  const data = me.data as MeResponse | undefined;
  const role = data?.user?.activeRole ?? null;
  const allowed = data ? areaAllows(area, role) : false;

  React.useEffect(() => {
    if (me.error) {
      router.replace('/sign-in');
      return;
    }
    if (data && !areaAllows(area, role)) {
      router.replace(roleToHome(role));
    }
  }, [me.error, data, area, role, router]);

  return { me, role, abilities: data?.abilities, ready: Boolean(data) && allowed };
}
