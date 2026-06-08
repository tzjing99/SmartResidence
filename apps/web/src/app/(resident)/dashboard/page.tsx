'use client';

import { DashboardSkeleton } from '@/components/route-skeletons';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { visitorStatusLabelKey, visitorStatusTone } from '@/lib/visitor-status';
import {
  useCondoAnnouncements,
  useMyCondos,
  useMyUnits,
  useUnitDefects,
  useUnitInvoices,
  useUnitVisitors,
} from '@smartresidence/api-client';
import { formatMoney } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState } from '@smartresidence/ui-web';
import { CalendarClock, CreditCard, Megaphone, Wrench } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string; condoId: string } | undefined;
  const condo = condos.data?.[0];
  const visitors = useUnitVisitors(api, unit?.id ?? null, 'upcoming');
  const invoices = useUnitInvoices(api, unit?.id ?? null);
  const defects = useUnitDefects(api, unit?.id ?? null);
  const announcements = useCondoAnnouncements(api, condo?.id ?? null);

  if (condos.isPending || units.isPending) {
    return <DashboardSkeleton />;
  }

  const upcomingVisitors = (visitors.data?.items ?? []).slice(0, 3);
  const openInvoice = (
    invoices.data?.items as
      | Array<{ id: string; status: string; total: number; number: string; dueDate: string }>
      | undefined
  )?.find((i) => i.status !== 'PAID' && i.status !== 'VOID');
  const openDefects = (defects.data?.items ?? []).filter(
    (d: any) => d.status !== 'CLOSED' && d.status !== 'RESOLVED',
  ).length;
  const announcement = (
    announcements.data?.items as
      | Array<{ id: string; title: string; importance: string }>
      | undefined
  )?.[0];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="sr-section-title">Welcome{unit ? `, unit ${unit.identifier}` : ''}.</h2>
        <p className="sr-muted mt-1">{condo?.name ?? 'Your condo at a glance.'}</p>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 sr-muted text-sm">
                <CreditCard className="size-4" /> Outstanding fee
              </div>
              {openInvoice ? (
                <>
                  <div className="text-2xl font-semibold mt-2">
                    {formatMoney(openInvoice.total)}
                  </div>
                  <div className="sr-muted text-xs mt-0.5">
                    {openInvoice.number} · due {new Date(openInvoice.dueDate).toLocaleDateString()}
                  </div>
                </>
              ) : (
                <div className="text-sm sr-muted mt-2">All clear — nothing due.</div>
              )}
            </div>
            <Link href="/billing">
              <Button variant="secondary" size="sm">
                View
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 sr-muted text-sm">
                <CalendarClock className="size-4" /> Upcoming visitors
              </div>
              <div className="text-2xl font-semibold mt-2">{upcomingVisitors.length}</div>
              <div className="sr-muted text-xs mt-0.5">today and tomorrow</div>
            </div>
            <Link href="/visitors">
              <Button size="sm">Pre-register</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 sr-muted text-sm">
                <Wrench className="size-4" /> Open defects
              </div>
              <div className="text-2xl font-semibold mt-2">{openDefects}</div>
            </div>
            <Link href="/defects">
              <Button variant="secondary" size="sm">
                Manage
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <Megaphone className="size-5 mt-0.5 sr-muted" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sr-muted">Latest announcement</span>
                {announcement && announcement.importance !== 'INFO' ? (
                  <Badge tone={announcement.importance === 'URGENT' ? 'danger' : 'warning'}>
                    {announcement.importance.toLowerCase()}
                  </Badge>
                ) : null}
              </div>
              <div className="font-medium mt-1 truncate">
                {announcement?.title ?? 'No announcements yet.'}
              </div>
              <Link
                href="/announcements"
                className="text-xs text-coral-500 hover:underline mt-1 inline-block"
              >
                See all →
              </Link>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Today's visitors</h3>
            <Link href="/visitors" className="text-sm text-coral-500 hover:underline">
              All visitors
            </Link>
          </div>
          {upcomingVisitors.length === 0 ? (
            <EmptyState
              title="No visitors expected"
              description="Pre-register friends, family, or contractors to skip the gate friction."
              action={
                <Link href="/visitors/new">
                  <Button>Pre-register a visitor</Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {upcomingVisitors.map((v: any) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[rgb(var(--sr-bg))]"
                >
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs sr-muted">
                      {new Date(v.expectedAt).toLocaleString()}
                      {v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}
                    </div>
                  </div>
                  <Badge tone={visitorStatusTone(v.status)}>
                    {t(visitorStatusLabelKey(v.status))}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
