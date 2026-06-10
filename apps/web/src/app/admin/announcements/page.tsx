'use client';

import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  type AnnouncementDetail,
  uploadAttachment,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useListUnits,
  useManageAnnouncements,
  useMyCondos,
  useUpdateAnnouncement,
} from '@smartresidence/api-client';
import {
  ANNOUNCEMENT_CATEGORY_OPTIONS,
  ANNOUNCEMENT_IMPORTANCE_OPTIONS,
  type AnnouncementAudienceScope,
  type AnnouncementCategory,
  type AnnouncementImportance,
  DOCUMENT_ACCEPT_ATTR,
  audienceLabel,
} from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
  cn,
} from '@smartresidence/ui-web';
import {
  FileText,
  Megaphone,
  Paperclip,
  Pin,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

type UnitRow = { id: string; identifier: string; block: { id: string; name: string } };

const selectCls = 'sr-select w-full';

const IMPORTANCE_TONE: Record<string, 'info' | 'warning' | 'danger'> = {
  INFO: 'info',
  IMPORTANT: 'warning',
  URGENT: 'danger',
};

const CATEGORY_LABEL: Record<string, string> = {
  NOTICE: 'Notice',
  DOCUMENT: 'Document',
  MAINTENANCE: 'Maintenance',
};

const AUDIENCE_OPTIONS: Array<{
  value: AnnouncementAudienceScope;
  label: string;
  description: string;
}> = [
  { value: 'CONDO', label: 'All residents', description: 'Everyone in the condo' },
  { value: 'BLOCKS', label: 'Specific blocks', description: 'Target one or more blocks' },
  { value: 'UNITS', label: 'Specific units', description: 'Send to selected homes only' },
];

function formatDate(value?: string | null) {
  if (!value) return 'Draft';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function deleteErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : '';
  if (message === 'Failed to fetch' || message.toLowerCase().includes('network')) {
    return 'Could not reach the API to remove this notice. Check that the API server is running and try again.';
  }
  return message || 'Could not remove this notice.';
}

export default function AdminAnnouncementsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const list = useManageAnnouncements(api, condo?.id ?? null, { limit: 20 });
  const units = useListUnits(api, condo?.id ?? null, { limit: 500 });
  const create = useCreateAnnouncement(api);
  const update = useUpdateAnnouncement(api);
  const remove = useDeleteAnnouncement(api);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('NOTICE');
  const [importance, setImportance] = useState<AnnouncementImportance>('INFO');
  const [audienceScope, setAudienceScope] = useState<AnnouncementAudienceScope>('CONDO');
  const [blockIds, setBlockIds] = useState<string[]>([]);
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [requiresAck, setRequiresAck] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const unitItems = (units.data?.items ?? []) as UnitRow[];
  const blocks = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const u of unitItems) {
      map.set(u.block.id, u.block);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [unitItems]);

  const announcements = list.data?.items ?? [];
  const publishedCount = announcements.filter((a) => Boolean(a.publishedAt)).length;
  const draftCount = announcements.length - publishedCount;
  const attachmentCount = announcements.reduce(
    (total, a) => total + (a.attachmentCount ?? a.attachments?.length ?? 0),
    0,
  );
  const selectedAudienceCount =
    audienceScope === 'BLOCKS'
      ? blockIds.length
      : audienceScope === 'UNITS'
        ? unitIds.length
        : null;
  const canSave = Boolean(condo && title.trim() && body.trim() && !create.isPending && !uploading);

  const resetForm = () => {
    setTitle('');
    setBody('');
    setCategory('NOTICE');
    setImportance('INFO');
    setAudienceScope('CONDO');
    setBlockIds([]);
    setUnitIds([]);
    setRequiresAck(false);
    setPinned(false);
    setAttachmentIds([]);
    setPdfName(null);
  };

  const audiencePayload = () => ({
    audienceScope,
    ...(audienceScope === 'BLOCKS' ? { blockIds } : {}),
    ...(audienceScope === 'UNITS' ? { unitIds } : {}),
  });

  const save = async (publish: boolean) => {
    if (!condo) return;
    try {
      await create.mutateAsync({
        condoId: condo.id,
        title: title.trim(),
        body: body.trim(),
        category,
        importance,
        requiresAck,
        pinned,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
        publishedAt: publish ? new Date() : null,
        ...audiencePayload(),
      });
      toast.success(publish ? 'Announcement published' : 'Draft saved');
      resetForm();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>, publish: boolean) => {
    event.preventDefault();
    void save(publish);
  };

  const onPdfChange = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadAttachment(api, {
        file,
        fileName: file.name,
        contentType: file.type || 'application/pdf',
      });
      setAttachmentIds([uploaded.attachmentId]);
      setPdfName(uploaded.fileName ?? file.name);
      toast.success('PDF uploaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const toggleBlock = (id: string) => {
    setBlockIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const toggleUnit = (id: string) => {
    setUnitIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  };

  const publishDraft = async (item: AnnouncementDetail) => {
    try {
      await update.mutateAsync({ id: item.id, body: { publishedAt: new Date() } });
      toast.success('Published');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const deleteItem = async (item: AnnouncementDetail) => {
    if (!condo) return;
    const confirmed = window.confirm(
      `Remove "${item.title}"? Residents will no longer see this notice.`,
    );
    if (!confirmed) return;
    setRemovingId(item.id);
    try {
      await remove.mutateAsync({ id: item.id, condoId: condo.id });
      toast.success('Notice removed');
    } catch (err) {
      toast.error(deleteErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="sr-muted mt-1">
            Compose resident notices, documents, and maintenance updates for targeted audiences.
          </p>
          <p className="text-xs sr-muted mt-1">{condo?.name ?? 'Select a condo to begin'}</p>
        </div>
        <Badge tone="neutral" className="mt-1">
          Phase 1
        </Badge>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Announcement summary">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm sr-muted">Published</span>
            <Send className="size-4 sr-muted" aria-hidden />
          </div>
          <div className="text-2xl font-semibold mt-2 tabular-nums">{publishedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm sr-muted">Drafts</span>
            <FileText className="size-4 sr-muted" aria-hidden />
          </div>
          <div className="text-2xl font-semibold mt-2 tabular-nums">{draftCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm sr-muted">PDFs</span>
            <Paperclip className="size-4 sr-muted" aria-hidden />
          </div>
          <div className="text-2xl font-semibold mt-2 tabular-nums">{attachmentCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm sr-muted">Audience</span>
            <Users className="size-4 sr-muted" aria-hidden />
          </div>
          <div className="text-sm font-medium mt-3">
            {selectedAudienceCount === null ? 'All residents' : `${selectedAudienceCount} selected`}
          </div>
        </Card>
      </section>

      <div className="grid xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] gap-6 items-start">
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/50 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-[rgb(var(--sr-coral))]/10 p-2 text-[rgb(var(--sr-coral))]">
                <Megaphone className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold">Compose announcement</h2>
                <p className="text-sm sr-muted mt-1">
                  Write once, save as draft, or publish immediately to the selected audience.
                </p>
              </div>
            </div>
          </div>

          <form className="flex flex-col gap-6 p-5" onSubmit={(event) => submit(event, true)}>
            <section className="grid md:grid-cols-[minmax(0,1fr)_16rem] gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="announcement-title">Title</Label>
                <Input
                  id="announcement-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lift maintenance this Friday"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="announcement-category">Category</Label>
                  <select
                    id="announcement-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                    className={selectCls}
                  >
                    {ANNOUNCEMENT_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="announcement-importance">Importance</Label>
                  <select
                    id="announcement-importance"
                    value={importance}
                    onChange={(e) => setImportance(e.target.value as AnnouncementImportance)}
                    className={selectCls}
                  >
                    {ANNOUNCEMENT_IMPORTANCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div>
                <Label>Audience</Label>
                <p className="text-xs sr-muted mt-1">
                  Targeting is fixed for residents once an announcement is published.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                {AUDIENCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAudienceScope(option.value)}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition-colors',
                      audienceScope === option.value
                        ? 'border-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral))]/10'
                        : 'border-[rgb(var(--sr-border))] hover:border-[rgb(var(--sr-coral))]/40',
                    )}
                  >
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs sr-muted mt-1">{option.description}</span>
                  </button>
                ))}
              </div>

              {audienceScope === 'BLOCKS' ? (
                <div className="rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Choose blocks</span>
                    <span className="text-xs sr-muted">{blockIds.length} selected</span>
                  </div>
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                    {blocks.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBlock(b.id)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs',
                          blockIds.includes(b.id)
                            ? 'border-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral))]/10'
                            : 'border-[rgb(var(--sr-border))]',
                        )}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {audienceScope === 'UNITS' ? (
                <div className="rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Choose units</span>
                    <span className="text-xs sr-muted">{unitIds.length} selected</span>
                  </div>
                  <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
                    {unitItems.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUnit(u.id)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs',
                          unitIds.includes(u.id)
                            ? 'border-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral))]/10'
                            : 'border-[rgb(var(--sr-border))]',
                        )}
                      >
                        {u.block.name} · {u.identifier}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="grid lg:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="announcement-body">Body (markdown)</Label>
                <Textarea
                  id="announcement-body"
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Add the key details residents need to know..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Preview</Label>
                <div className="min-h-[16rem] rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))] px-4 py-3 text-sm">
                  {body.trim() ? (
                    <Markdown>{body}</Markdown>
                  ) : (
                    <span className="sr-muted">Markdown preview appears here.</span>
                  )}
                </div>
              </div>
            </section>

            <section className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-4">
              <div className="rounded-2xl border border-dashed border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[rgb(var(--sr-card))] p-2">
                      <UploadCloud className="size-5 sr-muted" aria-hidden />
                    </div>
                    <div>
                      <Label htmlFor="announcement-pdf">PDF attachment</Label>
                      <p className="text-xs sr-muted mt-1">Optional document upload, max 25 MB.</p>
                      {pdfName ? (
                        <p className="mt-2 text-sm font-medium">
                          <Paperclip className="mr-1 inline size-4" aria-hidden />
                          {pdfName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Input
                    id="announcement-pdf"
                    className="max-w-xs"
                    type="file"
                    accept={DOCUMENT_ACCEPT_ATTR}
                    disabled={uploading}
                    onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[rgb(var(--sr-border))] p-4">
                <div className="text-sm font-medium">Delivery options</div>
                <div className="mt-3 flex flex-col gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={requiresAck}
                      onChange={(e) => setRequiresAck(e.target.checked)}
                    />
                    <ShieldCheck className="size-4 sr-muted" aria-hidden />
                    Requires acknowledgement
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pinned}
                      onChange={(e) => setPinned(e.target.checked)}
                    />
                    <Pin className="size-4 sr-muted" aria-hidden />
                    Pin to top
                  </label>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--sr-border))] pt-5">
              <p className="text-xs sr-muted">
                Drafts stay private until published. Published audience targeting is locked for
                residents.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  disabled={create.isPending}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void save(false)}
                  disabled={!canSave}
                >
                  Save draft
                </Button>
                <Button type="submit" disabled={!canSave}>
                  <Send className="size-4" aria-hidden />
                  Publish
                </Button>
              </div>
            </div>
          </form>
        </Card>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Manage announcements</h2>
            <p className="text-sm sr-muted">Recent drafts and published posts for this condo.</p>
          </div>

          {list.isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="Create a draft or publish your first resident update."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {announcements.map((a) => (
                <li key={a.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold leading-snug">{a.title}</h3>
                          {a.pinned ? <Badge tone="warning">Pinned</Badge> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sr-muted">
                          <span>{formatDate(a.publishedAt ?? a.createdAt)}</span>
                          <span>·</span>
                          <span>
                            {audienceLabel(a.audienceScope, {
                              blocks: a.audienceBlocks?.length,
                              units: a.audienceUnits?.length,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <Badge tone={a.publishedAt ? 'success' : 'neutral'}>
                          {a.publishedAt ? 'Published' : 'Draft'}
                        </Badge>
                        <Badge tone="neutral">{CATEGORY_LABEL[a.category] ?? a.category}</Badge>
                        <Badge tone={IMPORTANCE_TONE[a.importance] ?? 'info'}>
                          {a.importance.toLowerCase()}
                        </Badge>
                      </div>
                    </div>

                    <Markdown className="mt-3 max-h-24 overflow-hidden text-sm">{a.body}</Markdown>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--sr-border))] pt-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs sr-muted">
                        {a.requiresAck ? (
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="size-3.5" aria-hidden />
                            Acknowledgement required
                          </span>
                        ) : null}
                        {(a.attachmentCount ?? a.attachments?.length ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="size-3.5" aria-hidden />
                            {a.attachmentCount ?? a.attachments?.length} PDF
                          </span>
                        ) : null}
                        {a.publishedAt ? <span>Audience locked after publish</span> : null}
                      </div>
                      <div className="flex gap-2">
                        {!a.publishedAt ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => publishDraft(a)}
                            disabled={update.isPending}
                          >
                            Publish
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteItem(a)}
                          disabled={remove.isPending}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          {removingId === a.id ? 'Removing...' : 'Remove notice'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
