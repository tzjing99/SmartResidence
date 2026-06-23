'use client';

import { AnnouncementAttachments } from '@/components/announcement-attachments';
import {
  AnnouncementBodyProse,
  AnnouncementDetailTitle,
  AnnouncementHero,
  AnnouncementMetaLine,
  AnnouncementsPageShell,
  AnnouncementSectionLabel,
  AnnouncementSurface,
} from '@/components/announcements-ui';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useAckAnnouncement,
  useAnnouncement,
  useMarkAnnouncementRead,
} from '@smartresidence/api-client';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Skeleton } from '@smartresidence/ui-web';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function AnnouncementDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useAnnouncement(api, params.id);
  const markRead = useMarkAnnouncementRead(api);
  const ack = useAckAnnouncement(api);
  const a = detail.data;

  useEffect(() => {
    if (a && !a.readByMe) {
      markRead.mutate(a.id);
    }
  }, [a, markRead]);

  if (detail.isLoading) {
    return (
      <AnnouncementsPageShell variant="resident">
        <Skeleton className="h-72 rounded-2xl" />
      </AnnouncementsPageShell>
    );
  }

  if (!a) {
    return (
      <AnnouncementsPageShell variant="resident">
        <Link
          href="/announcements"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to announcements
        </Link>
        <p className="ann-page-subtitle">This notice could not be found.</p>
      </AnnouncementsPageShell>
    );
  }

  const publishedLabel = a.publishedAt
    ? new Date(a.publishedAt).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <AnnouncementsPageShell variant="resident">
      <Link
        href="/announcements"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline -mb-2"
      >
        <ArrowLeft className="size-4" />
        All announcements
      </Link>

      <AnnouncementHero>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {a.pinned ? <Badge tone="primary">Pinned</Badge> : null}
          <Badge tone="neutral">{ANNOUNCEMENT_CATEGORY_LABELS[a.category]}</Badge>
          {a.importance === 'URGENT' ? <Badge tone="danger">Urgent</Badge> : null}
          {a.importance === 'IMPORTANT' ? <Badge tone="warning">Important</Badge> : null}
        </div>
        <AnnouncementDetailTitle>{a.title}</AnnouncementDetailTitle>
        <AnnouncementMetaLine className="mt-3">
          {publishedLabel}
          {a.author?.name ? ` · ${a.author.name}` : null}
        </AnnouncementMetaLine>
      </AnnouncementHero>

      {a.attachments?.length ? (
        <AnnouncementSurface className="p-4 sm:p-5">
          <AnnouncementSectionLabel className="mb-3 block">
            Official memo & attachments
          </AnnouncementSectionLabel>
          <AnnouncementAttachments attachments={a.attachments} />
        </AnnouncementSurface>
      ) : null}

      <section>
        <AnnouncementSectionLabel className="mb-3 sm:mb-4 block">Summary</AnnouncementSectionLabel>
        <AnnouncementBodyProse>
          <Markdown>{a.body}</Markdown>
        </AnnouncementBodyProse>
      </section>

      {a.requiresAck && !a.ackedByMe ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 border-t border-[rgb(var(--sr-border))]/70">
          <Button
            className="w-full sm:w-auto"
            onClick={async () => {
              try {
                await ack.mutateAsync(a.id);
                toast.success('Acknowledged');
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            I acknowledge this notice
          </Button>
        </div>
      ) : a.requiresAck && a.ackedByMe ? (
        <p className="ann-meta text-right">You acknowledged this notice.</p>
      ) : null}
    </AnnouncementsPageShell>
  );
}
