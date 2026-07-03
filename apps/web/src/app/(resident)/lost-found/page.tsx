'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
import {
  useCondoLostFoundPosts,
  useCreateLostFoundPost,
  useMyCondos,
  useMyLostFoundPosts,
  useMyUnits,
  useRemoveLostFoundPost,
  useResolveLostFoundPost,
} from '@smartresidence/api-client';
import type { LostFoundKind, LostFoundPost, LostFoundStatus } from '@smartresidence/shared-types';
import { LOST_FOUND_KIND_LABELS, LOST_FOUND_STATUS_LABELS } from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@smartresidence/ui-web';
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

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function unitLabel(post: LostFoundPost) {
  const block = post.unit?.block?.name;
  const id = post.unit?.identifier;
  if (block && id) return `${block} · ${id}`;
  return id ?? '—';
}

function PostCard({
  post,
  mine,
  onResolve,
  onRemove,
  busy,
}: {
  post: LostFoundPost;
  mine?: boolean;
  onResolve?: (id: string) => void;
  onRemove?: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{post.title}</div>
          <div className="text-sm sr-muted mt-0.5">
            {LOST_FOUND_KIND_LABELS[post.kind]} · {unitLabel(post)}
            {post.user?.name ? ` · ${post.user.name}` : ''}
          </div>
          <div className="text-xs sr-muted mt-1">Posted {fmtDate(post.createdAt)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={KIND_TONE[post.kind]}>{LOST_FOUND_KIND_LABELS[post.kind]}</Badge>
          <Badge tone={STATUS_TONE[post.status]}>{LOST_FOUND_STATUS_LABELS[post.status]}</Badge>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap">{post.description}</p>
      {post.locationNote ? (
        <p className="text-sm sr-muted">
          <span className="font-medium text-[rgb(var(--sr-fg))]">Where: </span>
          {post.locationNote}
        </p>
      ) : null}
      <p className="text-sm">
        <span className="font-medium">Contact: </span>
        {post.contactMethod}
      </p>
      {mine && post.status === 'OPEN' ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" onClick={() => onResolve?.(post.id)} disabled={busy}>
            Mark resolved
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRemove?.(post.id)}
            disabled={busy}
          >
            Remove post
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function CreatePostForm({ condoId, unitId }: { condoId: string; unitId: string }) {
  const t = useT();
  const createPost = useCreateLostFoundPost(api);
  const [kind, setKind] = React.useState<LostFoundKind>('LOST');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [locationNote, setLocationNote] = React.useState('');
  const [contactMethod, setContactMethod] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createPost.mutateAsync({
        condoId,
        unitId,
        kind,
        title,
        description,
        locationNote: locationNote.trim() || undefined,
        contactMethod,
      });
      toast.success('Your post is on the board');
      setTitle('');
      setDescription('');
      setLocationNote('');
      setContactMethod('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create post');
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">Post to the board</h2>
      <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <div className="space-y-2">
          <Label htmlFor="lf-kind">What happened?</Label>
          <select
            id="lf-kind"
            className="sr-select w-full"
            value={kind}
            onChange={(e) => setKind(e.target.value as LostFoundKind)}
          >
            <option value="LOST">I lost something</option>
            <option value="FOUND">I found something</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lf-title">Short title</Label>
          <Input
            id="lf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lost house keys with blue tag"
            required
            minLength={3}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lf-desc">Description</Label>
          <Textarea
            id="lf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the item and any identifying details"
            required
            minLength={10}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lf-location">Location note (optional)</Label>
          <Input
            id="lf-location"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            placeholder="e.g. Near swimming pool, Block B lift lobby"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lf-contact">How can someone reach you?</Label>
          <Input
            id="lf-contact"
            value={contactMethod}
            onChange={(e) => setContactMethod(e.target.value)}
            placeholder="Phone, email, or ask guard house to hold message"
            required
            minLength={3}
            maxLength={200}
          />
        </div>
        <Button type="submit" loading={createPost.isPending}>
          {t('lostFound.postCta')}
        </Button>
      </form>
    </Card>
  );
}

export default function LostFoundPage() {
  const t = useT();
  const { abilities } = useRoleGuard('resident');
  const canCreate = hasAbility(abilities, 'create', 'LostFoundPost');
  const condos = useMyCondos(api);
  const units = useMyUnits(api);
  const condo = condos.data?.[0];
  const unit = units.data?.[0] as { id: string } | undefined;

  const [tab, setTab] = React.useState<'board' | 'mine'>('board');
  const [kindFilter, setKindFilter] = React.useState<'ALL' | LostFoundKind>('ALL');

  const boardQuery = useCondoLostFoundPosts(api, condo?.id ?? null, {
    openOnly: true,
    kind: kindFilter === 'ALL' ? undefined : kindFilter,
  });
  const mineQuery = useMyLostFoundPosts(api);
  const resolvePost = useResolveLostFoundPost(api);
  const removePost = useRemoveLostFoundPost(api);

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
    if (!window.confirm('Remove this post from the board?')) return;
    try {
      await removePost.mutateAsync(id);
      toast.success('Post removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove post');
    }
  }

  const busy = resolvePost.isPending || removePost.isPending;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title flex items-center gap-2">
          <Search className="size-6 text-coral-500" aria-hidden />
          {t('lostFound.title')}
        </h2>
        <p className="sr-muted mt-1">
          Community board for lost and found items — not for buying or selling.
        </p>
      </header>

      {canCreate && condo?.id && unit?.id ? (
        <CreatePostForm condoId={condo.id} unitId={unit.id} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === 'board' ? 'primary' : 'secondary'}
          onClick={() => setTab('board')}
        >
          Community board
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === 'mine' ? 'primary' : 'secondary'}
          onClick={() => setTab('mine')}
        >
          My posts
        </Button>
      </div>

      {tab === 'board' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'LOST', 'FOUND'] as const).map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={kindFilter === f ? 'primary' : 'secondary'}
                onClick={() => setKindFilter(f)}
              >
                {f === 'ALL' ? 'All open' : LOST_FOUND_KIND_LABELS[f]}
              </Button>
            ))}
          </div>
          {boardQuery.isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : (boardQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title={t('lostFound.boardEmptyTitle')}
              description="Open lost and found posts from residents will appear here."
              action={
                canCreate && condo?.id && unit?.id ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    Post something
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {boardQuery.data?.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </>
      ) : mineQuery.isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (mineQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Posts you create will show up here so you can track or update them."
          action={
            canCreate ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setTab('board')}>
                Browse community board
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {mineQuery.data?.items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              mine
              onResolve={handleResolve}
              onRemove={handleRemove}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
