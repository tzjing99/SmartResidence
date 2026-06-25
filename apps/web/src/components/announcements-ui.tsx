'use client';

import { cn } from '@smartresidence/ui-web';
import type { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** Resident list/detail uses a slightly narrower max width */
  variant?: 'admin' | 'resident';
};

export function AnnouncementsPageShell({ children, className, variant = 'admin' }: PageShellProps) {
  return (
    <div
      className={cn(
        'ann-page ann-page-backdrop flex flex-col gap-6 sm:gap-8',
        variant === 'resident' && 'ann-page-resident',
        className,
      )}
    >
      {children}
    </div>
  );
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function AnnouncementsPageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="ann-eyebrow">{eyebrow}</p> : null}
        <h1 className="ann-page-title">{title}</h1>
        {description ? <p className="ann-page-subtitle">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0 w-full sm:w-auto">{action}</div> : null}
    </header>
  );
}

export function AnnouncementSurface({
  children,
  className,
  muted,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <div className={cn(muted ? 'ann-surface-muted' : 'ann-surface', className)}>{children}</div>
  );
}

export function AnnouncementHero({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return <div className={cn('ann-hero', className)}>{children}</div>;
}

export function AnnouncementSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn('ann-section-label', className)}>{children}</h2>;
}

export function AnnouncementMetaLine({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn('ann-meta', className)}>{children}</p>;
}

export function AnnouncementMetaRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('ann-meta-row', className)}>{children}</div>;
}

export function AnnouncementListTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h3 className={cn('ann-list-title', className)}>{children}</h3>;
}

export function AnnouncementDetailTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h1 className={cn('ann-detail-title', className)}>{children}</h1>;
}

export function AnnouncementBodyProse({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('ann-body-prose', className)}>{children}</div>;
}

/** Two-column admin layout: list + sticky detail on large screens */
export function AnnouncementsAdminGrid({
  list,
  detail,
  className,
}: {
  list: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-6 lg:gap-8',
        detail ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start' : '',
        className,
      )}
    >
      <div className="min-w-0">{list}</div>
      {detail ? <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">{detail}</div> : null}
    </div>
  );
}

export function MetaDot() {
  return (
    <span aria-hidden className="opacity-40 select-none">
      ·
    </span>
  );
}

type CategoryFilterProps<T extends string> = {
  value: T | '' | 'insights';
  onChange: (value: T | '' | 'insights') => void;
  options: Array<{ value: T; label: string }>;
  allLabel?: string;
  insightsLabel?: string;
  showInsights?: boolean;
  className?: string;
  'aria-label'?: string;
};

/** Pill tabs for filtering announcements by category, with optional Insights metrics tab. */
export function AnnouncementCategoryFilter<T extends string>({
  value,
  onChange,
  options,
  allLabel = 'All',
  insightsLabel = 'Insights',
  showInsights = false,
  className,
  'aria-label': ariaLabel = 'Filter by category',
}: CategoryFilterProps<T>) {
  return (
    <div className={cn('ann-filter-row', className)} role="tablist" aria-label={ariaLabel}>
      <button
        type="button"
        role="tab"
        aria-selected={value === ''}
        className={cn('ann-filter-tab', value === '' && 'ann-filter-tab-active')}
        onClick={() => onChange('')}
      >
        {allLabel}
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={cn('ann-filter-tab', value === opt.value && 'ann-filter-tab-active')}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
      {showInsights ? (
        <button
          type="button"
          role="tab"
          aria-selected={value === 'insights'}
          className={cn('ann-filter-tab', value === 'insights' && 'ann-filter-tab-active')}
          onClick={() => onChange('insights')}
        >
          {insightsLabel}
        </button>
      ) : null}
    </div>
  );
}
