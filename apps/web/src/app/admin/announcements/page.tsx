'use client';

import { AnnouncementAttachments } from '@/components/announcement-attachments';
import {
  AnnouncementBodyProse,
  AnnouncementDetailTitle,
  AnnouncementHero,
  AnnouncementListTitle,
  AnnouncementMetaLine,
  AnnouncementSectionLabel,
  AnnouncementsAdminGrid,
  AnnouncementsPageHeader,
  AnnouncementsPageShell,
  AnnouncementSurface,
} from '@/components/announcements-ui';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  uploadAttachment,
  useCondoAnnouncements,
  useCondoBlocks,
  useCondoUnitsSearch,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useMyCondos,
  useUpdateAnnouncement,
} from '@smartresidence/api-client';
import type {
  Announcement,
  AnnouncementAudienceScope,
  AnnouncementCategory,
  AnnouncementImportance,
} from '@smartresidence/shared-types';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  DOCUMENT_ACCEPT_ATTR,
  MAX_ANNOUNCEMENT_ATTACHMENTS,
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
} from '@smartresidence/ui-web';
import { PhotoUpload } from '@smartresidence/ui-web';
import { ChevronRight, FileText, Loader2, Plus, Trash2, X } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

const IMPORTANCE_OPTIONS: { value: AnnouncementImportance; label: string }[] = [
  { value: 'INFO', label: 'Normal' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'URGENT', label: 'Urgent' },
];

const CATEGORY_OPTIONS = (
  Object.entries(ANNOUNCEMENT_CATEGORY_LABELS) as [AnnouncementCategory, string][]
).map(([value, label]) => ({ value, label }));

const AUDIENCE_OPTIONS: { value: AnnouncementAudienceScope; label: string; hint: string }[] = [
  { value: 'CONDO', label: 'Whole condo', hint: 'Every resident in the building' },
  { value: 'BLOCKS', label: 'Specific blocks', hint: 'Only units in selected blocks' },
  { value: 'UNITS', label: 'Specific units', hint: 'Named units only' },
];

type PendingPdf = {
  attachmentId: string;
  fileName: string;
  size: number;
};

type UnitRow = { id: string; identifier: string; block?: { name: string } | null };

function formatNoticeDate(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function noticeMetaLine(a: Announcement) {
  const parts = [
    a.publishedAt ? 'Published' : 'Draft',
    ANNOUNCEMENT_CATEGORY_LABELS[a.category],
    a.audienceSummary ?? 'Whole condo',
    formatNoticeDate(a.publishedAt ?? a.createdAt),
  ];
  if (a.attachments?.length) {
    parts.push(`${a.attachments.length} file${a.attachments.length === 1 ? '' : 's'}`);
  }
  if (a.pinned) parts.push('Pinned');
  if (a.importance !== 'INFO') parts.push(a.importance.toLowerCase());
  return parts.join(' · ');
}

function AdminNoticeRow({
  notice,
  selected,
  onSelect,
}: {
  notice: Announcement;
  selected: boolean;
  onSelect: () => void;
}) {
  const isPublished = Boolean(notice.publishedAt);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`ann-list-row ${
        selected ? 'ann-list-row-active' : 'ann-list-row-idle'
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <AnnouncementListTitle className="truncate">{notice.title}</AnnouncementListTitle>
          <AnnouncementMetaLine className="mt-1 truncate">{noticeMetaLine(notice)}</AnnouncementMetaLine>
        </div>
        <Badge tone={isPublished ? 'success' : 'neutral'} className="shrink-0 text-[11px]">
          {isPublished ? 'Live' : 'Draft'}
        </Badge>
        <ChevronRight className="size-4 shrink-0 text-[rgb(var(--sr-muted))] sm:size-5" />
      </div>
    </button>
  );
}

function AdminNoticeDetail({
  notice,
  onTogglePublish,
  onRemove,
  updatePending,
  removePending,
}: {
  notice: Announcement;
  onTogglePublish: () => void;
  onRemove: () => void;
  updatePending: boolean;
  removePending: boolean;
}) {
  const isPublished = Boolean(notice.publishedAt);
  return (
    <AnnouncementSurface className="p-5 sm:p-6">
      <AnnouncementHero className="mb-5 sm:mb-6 !p-4 sm:!p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <AnnouncementDetailTitle>{notice.title}</AnnouncementDetailTitle>
            <AnnouncementMetaLine className="mt-2">{noticeMetaLine(notice)}</AnnouncementMetaLine>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="secondary" size="sm" disabled={updatePending} onClick={onTogglePublish}>
              {isPublished ? 'Unpublish' : 'Publish'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={removePending}
              aria-label="Delete notice"
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </AnnouncementHero>

      <AnnouncementBodyProse>
        <Markdown>{notice.body}</Markdown>
      </AnnouncementBodyProse>

      {notice.attachments?.length ? (
        <div className="mt-6 pt-5 border-t border-[rgb(var(--sr-border))]/70">
          <AnnouncementSectionLabel className="mb-3 block">Attachments</AnnouncementSectionLabel>
          <AnnouncementAttachments attachments={notice.attachments} />
        </div>
      ) : null}
    </AnnouncementSurface>
  );
}

export default function AdminAnnouncementsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const condoId = condo?.id ?? null;
  const list = useCondoAnnouncements(api, condoId, { manage: true });
  const blocks = useCondoBlocks(api, condoId);
  const create = useCreateAnnouncement(api);
  const update = useUpdateAnnouncement(api);
  const remove = useDeleteAnnouncement(api);

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [importance, setImportance] = React.useState<AnnouncementImportance>('INFO');
  const [category, setCategory] = React.useState<AnnouncementCategory>('DOCUMENT');
  const [audienceScope, setAudienceScope] = React.useState<AnnouncementAudienceScope>('CONDO');
  const [selectedBlockIds, setSelectedBlockIds] = React.useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = React.useState<string[]>([]);
  const [unitSearch, setUnitSearch] = React.useState('');
  const unitResults = useCondoUnitsSearch(api, condoId, unitSearch, audienceScope === 'UNITS');
  const [pinned, setPinned] = React.useState(false);
  const [requiresAck, setRequiresAck] = React.useState(false);
  const [imageIds, setImageIds] = React.useState<string[]>([]);
  const [pdfMemo, setPdfMemo] = React.useState<PendingPdf | null>(null);
  const [pdfUploading, setPdfUploading] = React.useState(false);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const photoRef = React.useRef<{ reset: () => void } | null>(null);
  const composeRef = React.useRef<HTMLDivElement>(null);

  const attachmentIds = React.useMemo(
    () => [...(pdfMemo ? [pdfMemo.attachmentId] : []), ...imageIds],
    [imageIds, pdfMemo],
  );

  const items = list.data?.items ?? [];
  const selected = items.find((a) => a.id === selectedId) ?? null;

  React.useEffect(() => {
    if (selectedId && !items.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [items, selectedId]);

  function resetForm() {
    setTitle('');
    setBody('');
    setImportance('INFO');
    setCategory('DOCUMENT');
    setAudienceScope('CONDO');
    setSelectedBlockIds([]);
    setSelectedUnitIds([]);
    setUnitSearch('');
    setPinned(false);
    setRequiresAck(false);
    setImageIds([]);
    setPdfMemo(null);
    photoRef.current?.reset();
  }

  function openCompose() {
    setComposeOpen(true);
    setSelectedId(null);
    requestAnimationFrame(() => {
      composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function closeCompose() {
    setComposeOpen(false);
    resetForm();
  }

  function toggleBlock(blockId: string) {
    setSelectedBlockIds((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId],
    );
  }

  function toggleUnit(unitId: string) {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId],
    );
  }

  async function onPdfSelected(file: File) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF memo');
      return;
    }
    setPdfUploading(true);
    try {
      const uploaded = await uploadAttachment(api, {
        fileName: file.name,
        contentType: 'application/pdf',
        file,
      });
      setPdfMemo({
        attachmentId: uploaded.attachmentId,
        fileName: file.name,
        size: uploaded.size,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPdfUploading(false);
    }
  }

  async function onPublish(e: React.FormEvent) {
    e.preventDefault();
    if (!condoId || !title.trim() || !body.trim()) {
      toast.error('Title and summary are required');
      return;
    }
    if (audienceScope === 'BLOCKS' && selectedBlockIds.length === 0) {
      toast.error('Select at least one block');
      return;
    }
    if (audienceScope === 'UNITS' && selectedUnitIds.length === 0) {
      toast.error('Select at least one unit');
      return;
    }
    try {
      await create.mutateAsync({
        condoId,
        title: title.trim(),
        body: body.trim(),
        importance,
        category,
        audienceScope,
        blockIds: audienceScope === 'BLOCKS' ? selectedBlockIds : undefined,
        unitIds: audienceScope === 'UNITS' ? selectedUnitIds : undefined,
        pinned,
        requiresAck,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      });
      toast.success('Notice published');
      resetForm();
      setComposeOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onTogglePublish(a: Announcement) {
    const isPublished = Boolean(a.publishedAt);
    try {
      await update.mutateAsync({
        id: a.id,
        data: { publishedAt: isPublished ? null : new Date() },
      });
      toast.success(isPublished ? 'Moved to draft' : 'Published');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onRemove(id: string, noticeTitle: string) {
    if (!window.confirm(`Delete "${noticeTitle}"? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Notice deleted');
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      const message = (err as Error).message;
      toast.error(
        message.includes('fetch')
          ? 'Could not reach the server — is the API running?'
          : message,
      );
    }
  }

  const unitItems = (unitResults.data?.items ?? []) as UnitRow[];

  return (
    <AnnouncementsPageShell>
      <AnnouncementsPageHeader
        eyebrow="Management"
        title="Announcements"
        description="Publish notices to the whole condo, selected blocks, or specific units. Residents only see what applies to them."
        action={
          !composeOpen ? (
            <Button className="w-full sm:w-auto" onClick={openCompose}>
              <Plus className="size-4" />
              New notice
            </Button>
          ) : undefined
        }
      />

      {composeOpen ? (
        <Card
          ref={composeRef}
          className="ann-surface !rounded-2xl !p-5 sm:!p-7 shadow-card border-[rgb(var(--sr-border))]/75"
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="ann-eyebrow mb-1">Compose</p>
              <h3 className="ann-detail-title text-xl sm:text-2xl">New notice</h3>
              <p className="ann-page-subtitle mt-2 !max-w-none">
                Choose who sees it, write a short summary, then attach the official memo if you
                have one.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" aria-label="Close" onClick={closeCompose}>
              <X className="size-4" />
            </Button>
          </div>

          <form className="flex flex-col gap-6" onSubmit={onPublish}>
            <section className="flex flex-col gap-3">
              <div>
                <AnnouncementSectionLabel className="block text-sm normal-case tracking-normal font-medium text-[rgb(var(--sr-fg))]">
                  Audience
                </AnnouncementSectionLabel>
                <p className="ann-meta mt-1">Who should receive this notice?</p>
              </div>
              <div className="flex flex-col gap-2 sm:gap-2.5">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-xl sm:rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4 cursor-pointer transition-colors ${
                      audienceScope === opt.value
                        ? 'border-[rgb(var(--sr-coral)/0.55)] bg-[rgb(var(--sr-coral)/0.05)]'
                        : 'border-[rgb(var(--sr-border))]/80 bg-[rgb(var(--sr-card))] hover:border-[rgb(var(--sr-coral)/0.25)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      className="mt-1"
                      checked={audienceScope === opt.value}
                      onChange={() => setAudienceScope(opt.value)}
                    />
                    <span>
                      <span className="text-sm font-medium block">{opt.label}</span>
                      <span className="text-xs sr-muted">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              {audienceScope === 'BLOCKS' ? (
                <div className="ann-surface-muted p-3 sm:p-4 max-h-48 overflow-y-auto">
                  {blocks.isLoading ? (
                    <Skeleton className="h-8" />
                  ) : (blocks.data?.length ?? 0) === 0 ? (
                    <p className="text-sm sr-muted">No blocks configured for this condo.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {blocks.data?.map((b) => (
                        <label key={b.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedBlockIds.includes(b.id)}
                            onChange={() => toggleBlock(b.id)}
                          />
                          {b.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {audienceScope === 'UNITS' ? (
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Search unit number…"
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                  />
                  {selectedUnitIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUnitIds.map((id) => {
                        const u = unitItems.find((x) => x.id === id);
                        const label =
                          u?.identifier ??
                          items
                            .flatMap((n) => n.audienceUnits ?? [])
                            .find((x) => x.id === id)?.identifier ??
                          id.slice(0, 8);
                        return (
                          <button
                            key={id}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--sr-bg))] border border-[rgb(var(--sr-border))] px-2.5 py-0.5 text-xs"
                            onClick={() => toggleUnit(id)}
                          >
                            {label}
                            <X className="size-3" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="ann-surface-muted max-h-48 overflow-y-auto divide-y divide-[rgb(var(--sr-border))]/60">
                    {unitResults.isFetching && unitSearch ? (
                      <div className="p-3 text-sm sr-muted">Searching…</div>
                    ) : unitItems.length === 0 ? (
                      <div className="p-3 text-sm sr-muted">
                        {unitSearch ? 'No units match your search.' : 'Type to search units.'}
                      </div>
                    ) : (
                      unitItems.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[rgb(var(--sr-bg))]/60"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUnitIds.includes(u.id)}
                            onChange={() => toggleUnit(u.id)}
                          />
                          <span>
                            {u.identifier}
                            {u.block?.name ? (
                              <span className="sr-muted"> · {u.block.name}</span>
                            ) : null}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lift maintenance — Block A"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ann-category">Type</Label>
                <select
                  id="ann-category"
                  className={selectCls}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ann-importance">Priority</Label>
                <select
                  id="ann-importance"
                  className={selectCls}
                  value={importance}
                  onChange={(e) => setImportance(e.target.value as AnnouncementImportance)}
                >
                  {IMPORTANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="flex flex-col gap-1.5">
              <Label htmlFor="ann-body">Summary for residents</Label>
              <Textarea
                id="ann-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What happened, who is affected, and what residents should do. Keep it short — full details go in the PDF memo."
              />
            </section>

            <section className="flex flex-col gap-2">
              <Label>Official memo (PDF, optional)</Label>
              {pdfMemo ? (
                <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/50 px-4 py-3">
                  <FileText className="size-5 shrink-0 text-[rgb(var(--sr-coral))]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{pdfMemo.fileName}</div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPdfMemo(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pdfUploading}
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[rgb(var(--sr-border))] px-4 py-4 text-sm font-medium text-[rgb(var(--sr-coral))] hover:bg-[rgb(var(--sr-coral)/0.05)] disabled:opacity-60"
                >
                  {pdfUploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <FileText className="size-4" />
                      Upload PDF memo
                    </>
                  )}
                </button>
              )}
              <input
                ref={pdfInputRef}
                type="file"
                accept={DOCUMENT_ACCEPT_ATTR}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onPdfSelected(file);
                  e.target.value = '';
                }}
              />
            </section>

            <section className="flex flex-col gap-2">
              <Label>Photos (optional)</Label>
              <PhotoUpload
                ref={photoRef}
                maxFiles={Math.max(0, MAX_ANNOUNCEMENT_ATTACHMENTS - (pdfMemo ? 1 : 0))}
                onChange={setImageIds}
                upload={(file, opts) =>
                  uploadAttachment(
                    api,
                    {
                      fileName: file.name,
                      contentType: file.type || 'image/jpeg',
                      file,
                    },
                    opts,
                  ).then((r) => ({ attachmentId: r.attachmentId }))
                }
              />
            </section>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                Pin to top of list
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requiresAck}
                  onChange={(e) => setRequiresAck(e.target.checked)}
                />
                Require acknowledgement
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 border-t border-[rgb(var(--sr-border))]/70">
              <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={closeCompose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={!title.trim() || !body.trim() || create.isPending}
              >
                {create.isPending ? 'Publishing…' : 'Publish notice'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <AnnouncementsAdminGrid
        detail={
          selected && !composeOpen ? (
            <AdminNoticeDetail
              notice={selected}
              updatePending={update.isPending}
              removePending={remove.isPending}
              onTogglePublish={() => void onTogglePublish(selected)}
              onRemove={() => void onRemove(selected.id, selected.title)}
            />
          ) : undefined
        }
        list={
          <div>
            <AnnouncementSectionLabel className="mb-3 sm:mb-4 block text-sm normal-case tracking-normal font-semibold text-[rgb(var(--sr-fg))]">
              All notices
            </AnnouncementSectionLabel>
            {list.isLoading ? (
              <Skeleton className="h-28 rounded-2xl" />
            ) : items.length === 0 ? (
              <EmptyState
                title="No notices yet"
                description="Create your first notice — residents will only see published items that match their unit or block."
              />
            ) : (
              <ul className="flex flex-col gap-2 sm:gap-2.5">
                {items.map((a) => (
                  <li key={a.id}>
                    <AdminNoticeRow
                      notice={a}
                      selected={selectedId === a.id}
                      onSelect={() => setSelectedId((prev) => (prev === a.id ? null : a.id))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
      />
    </AnnouncementsPageShell>
  );
}
