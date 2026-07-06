'use client';

import { AdminFilterBar, AdminFilterPill, AdminPageHeader } from '@/components/admin-ui';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCondoLostFoundPosts,
  useModerateRemoveLostFoundPost,
  useMyCondos,
  useResolveLostFoundPost,
} from '@smartresidence/api-client';
import type { LostFoundKind, LostFoundPost, LostFoundStatus } from '@smartresidence/shared-types';
import { LOST_FOUND_KIND_LABELS, LOST_FOUND_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Search } from 'lucide-react';
import * as React from 'react';

const KIND_TONE: Record<LostFoundKind, 'warning' | 'success'> = {
  LOST: 'warning',
  FOUND: 'success',
};

const STATUS_TONE: Record<LostFoundStatus, 'neutral' | 'success' | 'warning'> = {
  OPEN: 'warning',
  RESOLVED: 'success',
  REMOVED: 'neutral',
};

function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function unitLabel(post: LostFoundPost) {
  const block = post.unit?.block?.name;
  const id = post.unit?.identifier;
  if (block && id) return `${block} · ${id}`;
  return id ?? '—';
}

export default function AdminLostFoundPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | LostFoundStatus>('OPEN');
  const params = statusFilter === 'ALL' ? { manage: true } : { manage: true, status: statusFilter };
  const postsQuery = useCondoLostFoundPosts(api, condo?.id ?? null, params);
  const resolvePost = useResolveLostFoundPost(api);
  const moderateRemove = useModerateRemoveLostFoundPost(api);

  async function handleResolve(id: string) {
    if (!window.confirm('Mark this post as resolved?')) return;
    try {
      await resolvePost.mutateAsync(id);
      toast.success('Post marked resolved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update post');
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Remove this post from the board? This cannot be undone.')) return;
    try {
      await moderateRemove.mutateAsync(id);
      toast.success('Post removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove post');
    }
  }

  const busy = resolvePost.isPending || moderateRemove.isPending;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <AdminPageHeader
        eyebrow="More"
        icon={Search}
        title={t('admin.lostFound.title')}
        description="Review community lost and found posts. This is not a marketplace — no sales or pricing."
      />

      <AdminFilterBar>
        {(['OPEN', 'RESOLVED', 'REMOVED', 'ALL'] as const).map((f) => (
          <AdminFilterPill key={f} active={statusFilter === f} onClick={() => setStatusFilter(f)}>
            {f === 'ALL' ? 'All statuses' : LOST_FOUND_STATUS_LABELS[f]}
          </AdminFilterPill>
        ))}
      </AdminFilterBar>

      {postsQuery.isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (postsQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="No posts in this view"
          description="When residents report lost or found items, they'll appear here for moderation."
        />
      ) : (
        <div className="space-y-3">
          {postsQuery.data?.items.map((post) => (
            <Card key={post.id} className="!p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{post.title}</div>
                  <div className="text-sm sr-muted">
                    {LOST_FOUND_KIND_LABELS[post.kind]} · {unitLabel(post)} ·{' '}
                    {post.user?.name ?? 'Resident'}
                  </div>
                  <div className="text-xs sr-muted mt-1">Posted {fmtDateTime(post.createdAt)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={KIND_TONE[post.kind]}>{LOST_FOUND_KIND_LABELS[post.kind]}</Badge>
                  <Badge tone={STATUS_TONE[post.status]}>
                    {LOST_FOUND_STATUS_LABELS[post.status]}
                  </Badge>
                </div>
              </div>
              {post.description ? (
                <p className="text-sm sr-muted whitespace-pre-wrap">{post.description}</p>
              ) : null}
              {post.status === 'OPEN' ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => handleResolve(post.id)}
                  >
                    Mark resolved
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => handleRemove(post.id)}
                  >
                    Remove post
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
