import { useMe } from '@smartresidence/api-client';
import type { RoleId } from '@smartresidence/shared-types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { api } from './api';
import { getCachedSession, setCached, writeSession } from './session';
import {
  type MeResponse,
  type MobileArea,
  areaAllows,
  roleToHomePath,
} from './roles';

interface RoleGuardResult {
  role: RoleId | null;
  /** True once `/api/auth/me` resolved and the user's role belongs in this area. */
  ready: boolean;
}

/**
 * Redirects users away from route groups they do not belong in (e.g. guards out of
 * resident tabs). Mirrors the web app's `useRoleGuard`.
 */
export function useRoleGuard(area: MobileArea): RoleGuardResult {
  const router = useRouter();
  const me = useMe(api);
  const data = me.data as MeResponse | undefined;
  const role = data?.user?.activeRole ?? null;
  const allowed = data ? areaAllows(area, role) : false;

  useEffect(() => {
    if (me.isError && !me.isFetching) {
      void getCachedSession().then(async (session) => {
        if (!session?.accessToken) {
          await writeSession(null);
          setCached(null);
          router.replace('/sign-in');
          return;
        }
        if (!me.data) {
          void me.refetch();
        }
      });
      return;
    }
    if (data && !areaAllows(area, role)) {
      router.replace(roleToHomePath(role));
    }
  }, [me.isError, me.isFetching, me.data, me, data, area, role, router]);

  return { role, ready: Boolean(data) && allowed };
}
