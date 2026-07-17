'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { useMyUnits, useUnitAccessRestrictionStatus } from '@smartresidence/api-client';
import { Button } from '@smartresidence/ui-web';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Proactive pay-to-unlock notice when the resident unit is soft-blocked. */
export function ArrearsAccessBanner() {
  const t = useT();
  const pathname = usePathname();
  const units = useMyUnits(api);
  const unitId = (units.data?.[0] as { id?: string } | undefined)?.id ?? null;
  const status = useUnitAccessRestrictionStatus(api, unitId);

  const data = status.data;
  if (!data?.restricted) return null;
  if (pathname === '/billing' || pathname.startsWith('/billing/')) return null;

  const anyBlocked =
    data.blocked.facility ||
    data.blocked.visitors ||
    data.blocked.deliveryPasses ||
    data.blocked.recurringPasses;
  if (!anyBlocked) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="flex gap-3 min-w-0 flex-1">
        <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-[rgb(var(--sr-fg))]">
            {t('billing.accessRestrictedTitle')}
          </p>
          <p className="text-sm sr-muted">{t('billing.accessRestrictedBannerBody')}</p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0 self-start sm:self-center">
        <Link href="/billing">{t('billing.accessRestrictedPay')}</Link>
      </Button>
    </div>
  );
}
