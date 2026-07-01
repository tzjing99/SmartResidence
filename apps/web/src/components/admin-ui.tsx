'use client';

import { cn } from '@smartresidence/ui-web';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Info } from 'lucide-react';
import * as React from 'react';

/** Consistent page header for admin list and detail pages. */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm sr-muted">{eyebrow}</p> : null}
        <div className={cn('flex items-center gap-2.5', eyebrow ? 'mt-0.5' : '')}>
          {Icon ? <Icon className="size-7 shrink-0 text-coral-500" aria-hidden /> : null}
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        {description ? (
          <p className="sr-muted mt-1.5 max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Filter row with consistent height and spacing across list pages. */
export function AdminFilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-9 flex-wrap items-center gap-2', className)}>{children}</div>
  );
}

/** Pill-style filter toggle used on invoices, parcels, lost & found, etc. */
export function AdminFilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-[rgb(var(--sr-coral)/0.55)] bg-[rgb(var(--sr-coral)/0.08)] text-[rgb(var(--sr-coral))]'
          : 'border-[rgb(var(--sr-border))] sr-muted hover:border-[rgb(var(--sr-coral)/0.3)]',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Compact compliance callout — summary visible, details on expand. */
export function AdminComplianceNote({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const hasDetails = Boolean(children);

  return (
    <div className="rounded-xl border border-[rgb(var(--sr-coral))]/20 bg-[rgb(var(--sr-bg))]/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-coral-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{title}</span>
            <span className="sr-muted"> — {summary}</span>
          </p>
          {hasDetails && open ? (
            <div className="mt-2 text-sm sr-muted leading-relaxed">{children}</div>
          ) : null}
        </div>
        {hasDetails ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-coral-500 hover:underline"
            aria-expanded={open}
          >
            {open ? 'Less' : 'Learn more'}
            <ChevronDown
              className={cn('size-3.5 transition-transform', open ? 'rotate-180' : '')}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Date range + export actions aligned on money pages. */
export function AdminExportToolbar({
  children,
  exports,
  className,
}: {
  children?: React.ReactNode;
  exports?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      {children ? <div className="flex flex-wrap items-end gap-3">{children}</div> : null}
      {exports ? <div className="flex flex-wrap gap-2">{exports}</div> : null}
    </section>
  );
}

/** Standard admin list table wrapper — consistent row padding and dividers. */
export function AdminListTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))]">
      {children}
    </div>
  );
}

export const adminTableHeadClass =
  'text-left text-xs uppercase sr-muted border-b border-[rgb(var(--sr-border))]';
export const adminTableRowClass =
  'transition-colors hover:bg-[rgb(var(--sr-bg))]/60 divide-y divide-[rgb(var(--sr-border))]';
export const adminTableCellClass = 'py-3 px-4';
