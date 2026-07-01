'use client';

import { api } from '@/lib/api';
import { type AbilityRule, hasAbility } from '@/lib/roles';
import { queryKeys, useMe } from '@smartresidence/api-client';
import { Card } from '@smartresidence/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Settings2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { SETTINGS_AREAS, SETTINGS_GROUP_ORDER, type SettingsArea } from './settings-nav';

function AreaCard({ area }: { area: SettingsArea }) {
  const Icon = area.icon;
  return (
    <Card
      interactive
      className="group !p-0 overflow-hidden transition-colors hover:border-[rgb(var(--sr-coral)/0.4)]"
    >
      <Link
        href={area.href}
        className="flex h-full items-start gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-coral-500/50 rounded-[inherit]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))] text-[rgb(var(--sr-coral))]">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="font-semibold leading-tight">{area.label}</span>
            <ChevronRight className="size-4 sr-muted transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1 block text-sm sr-muted">{area.description}</span>
          <span className="mt-2 inline-block rounded-full bg-[rgb(var(--sr-bg))] px-2.5 py-0.5 text-[11px] font-medium sr-muted border border-[rgb(var(--sr-border))]/70">
            For {area.audience.toLowerCase()}
          </span>
        </span>
      </Link>
    </Card>
  );
}

export default function AdminSettingsIndexPage() {
  const qc = useQueryClient();
  const me = useMe(api);
  const cached = qc.getQueryData(queryKeys.me) as { abilities?: AbilityRule[] } | undefined;
  const abilities = (cached?.abilities ??
    (me.data as { abilities?: AbilityRule[] } | undefined)?.abilities ??
    []) as AbilityRule[];

  const visibleAreas = React.useMemo(
    () =>
      SETTINGS_AREAS.filter(
        (area) => !area.can || hasAbility(abilities, area.can.action, area.can.subject),
      ),
    [abilities],
  );

  const sections = React.useMemo(
    () =>
      SETTINGS_GROUP_ORDER.map((group) => ({
        group,
        areas: visibleAreas.filter((area) => area.group === group),
      })).filter((section) => section.areas.length > 0),
    [visibleAreas],
  );

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Settings2 className="size-6 text-coral-500" />
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="sr-muted max-w-2xl">
          Configure how your building runs — billing, helpdesk, access, and more. Pick an area to
          get started.
        </p>
      </header>

      {sections.length === 0 ? (
        <Card className="text-sm sr-muted">
          You don&apos;t have access to any settings areas. Ask an administrator if you need to
          manage building configuration.
        </Card>
      ) : (
        sections.map((section) => (
          <section key={section.group} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide sr-muted">
              {section.group}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.areas.map((area) => (
                <AreaCard key={area.href} area={area} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
