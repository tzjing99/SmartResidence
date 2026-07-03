'use client';

import { useT } from '@/i18n/locale-provider';
import {
  AnnouncementCategoryFilter,
  AnnouncementListTitle,
  AnnouncementMetaRow,
  AnnouncementSurface,
  AnnouncementsPageHeader,
  AnnouncementsPageShell,
  MetaDot,
} from '@/components/announcements-ui';
import { api } from '@/lib/api';
import { useCondoAnnouncements, useMyCondos } from '@smartresidence/api-client';
import type { Announcement, AnnouncementCategory } from '@smartresidence/shared-types';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  announcementExcerpt,
  isPdfMime,
} from '@smartresidence/shared-types';
import { Badge, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

const CATEGORY_OPTIONS = (
  Object.entries(ANNOUNCEMENT_CATEGORY_LABELS) as [AnnouncementCategory, string][]
).map(([value, label]) => ({ value, label }));

function formatListDate(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function AnnouncementListItem({ announcement: a }: { announcement: Announcement }) {
  const hasPdf = a.attachments?.some((att) => isPdfMime(att.mimeType));
  const isUnread = !a.readByMe;

  return (
    <Link href={`/announcements/${a.id}`} className="ann-resident-link group">
      <AnnouncementSurface className="p-4 sm:p-5 group-hover:border-[rgb(var(--sr-coral)/0.4)]">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className={`mt-2.5 size-2 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--sr-card))] ${
              isUnread
                ? 'bg-[rgb(var(--sr-coral))] ring-[rgb(var(--sr-coral)/0.25)]'
                : 'bg-transparent ring-transparent'
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <AnnouncementListTitle>{a.title}</AnnouncementListTitle>
              <Badge tone="neutral" className="text-[10px] px-1.5 py-0">
                {ANNOUNCEMENT_CATEGORY_LABELS[a.category]}
              </Badge>
              {a.pinned ? (
                <Badge tone="primary" className="text-[10px] px-1.5 py-0">
                  Pinned
                </Badge>
              ) : null}
              {a.importance === 'URGENT' ? (
                <Badge tone="danger" className="text-[10px] px-1.5 py-0">
                  Urgent
                </Badge>
              ) : a.importance === 'IMPORTANT' ? (
                <Badge tone="warning" className="text-[10px] px-1.5 py-0">
                  Important
                </Badge>
              ) : null}
            </div>
            <p className="text-sm sm:text-[15px] leading-relaxed sr-muted line-clamp-2">
              {announcementExcerpt(a.body, 140)}
            </p>
            <AnnouncementMetaRow className="mt-2.5">
              <span>{formatListDate(a.publishedAt ?? a.createdAt)}</span>
              <MetaDot />
              <span>{ANNOUNCEMENT_CATEGORY_LABELS[a.category]}</span>
              {hasPdf ? (
                <>
                  <MetaDot />
                  <span className="inline-flex items-center gap-1 text-[rgb(var(--sr-coral))] font-medium">
                    <FileText className="size-3.5" />
                    PDF memo
                  </span>
                </>
              ) : null}
              {a.requiresAck && !a.ackedByMe ? (
                <>
                  <MetaDot />
                  <span className="text-[rgb(var(--sr-coral))] font-medium">Ack required</span>
                </>
              ) : null}
            </AnnouncementMetaRow>
          </div>
          <ChevronRight className="size-5 shrink-0 text-[rgb(var(--sr-muted))] mt-1 group-hover:text-[rgb(var(--sr-coral))] transition-colors" />
        </div>
      </AnnouncementSurface>
    </Link>
  );
}

export default function AnnouncementsPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [categoryFilter, setCategoryFilter] = React.useState<AnnouncementCategory | ''>('');
  const list = useCondoAnnouncements(api, condo?.id ?? null, {
    category: categoryFilter || undefined,
  });

  return (
    <AnnouncementsPageShell variant="resident">
      <AnnouncementsPageHeader
        eyebrow={t("announcements.eyebrow")}
        title={t("announcements.title")}
        description="Official memos and updates from your management office."
      />
      <AnnouncementCategoryFilter
        value={categoryFilter}
        onChange={(value) => {
          if (value !== 'insights') setCategoryFilter(value);
        }}
        options={CATEGORY_OPTIONS}
      />
      {list.isLoading ? (
        <Skeleton className="h-36 rounded-2xl" />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState title={t("announcements.emptyTitle")} description="Announcements will show up here." />
      ) : (
        <ul className="flex flex-col gap-3 sm:gap-3.5">
          {list.data?.items.map((a) => (
            <li key={a.id}>
              <AnnouncementListItem announcement={a} />
            </li>
          ))}
        </ul>
      )}
    </AnnouncementsPageShell>
  );
}
