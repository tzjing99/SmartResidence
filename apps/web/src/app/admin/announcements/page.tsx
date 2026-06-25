'use client';

import { AnnouncementAttachments } from '@/components/announcement-attachments';
import {
  AnnouncementBodyProse,
  AnnouncementCategoryFilter,
  AnnouncementDetailTitle,
  AnnouncementHero,
  AnnouncementListTitle,
  AnnouncementMetaLine,
  AnnouncementSectionLabel,
  AnnouncementSurface,
  AnnouncementsAdminGrid,
  AnnouncementsPageHeader,
  AnnouncementsPageShell,
} from '@/components/announcements-ui';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  uploadAttachment,
  useAnnouncementReadStats,
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
  ANNOUNCEMENT_STATUS_LABELS,
  DOCUMENT_ACCEPT_ATTR,
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  announcementStatus,
} from '@smartresidence/shared-types';
import type { AnnouncementStatus } from '@smartresidence/shared-types';
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
import { ChevronRight, FileText, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
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

type ListFilter = AnnouncementCategory | '' | 'insights';
type InsightsSort = 'date' | 'readRate';

type UnitRow = { id: string; identifier: string; block?: { name: string } | null };

function toDatetimeLocal(d: Date | string) {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readStatsLine(stats?: Announcement['readStats']) {
  if (!stats) return null;
  if (stats.recipientCount === 0) return 'No audience recipients yet';
  return `${stats.readCount} read · ${stats.readPercent}% read`;
}

function formatNoticeDate(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatNoticeDateTime(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_TONE: Record<AnnouncementStatus, 'success' | 'neutral' | 'info' | 'warning'> = {
  PUBLISHED: 'success',
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  EXPIRED: 'warning',
};

function noticeMetaLine(a: Announcement) {
  const status = a.status ?? announcementStatus(a);
  const parts: string[] = [];
  if (status === 'SCHEDULED') {
    parts.push(`Goes live ${formatNoticeDateTime(a.publishedAt)}`);
  } else if (status === 'EXPIRED') {
    parts.push(`Expired ${formatNoticeDate(a.expiresAt)}`);
  } else if (status === 'PUBLISHED') {
    parts.push(formatNoticeDate(a.publishedAt));
    if (a.expiresAt) parts.push(`until ${formatNoticeDate(a.expiresAt)}`);
  } else {
    parts.push('Not published');
  }
  parts.push(ANNOUNCEMENT_CATEGORY_LABELS[a.category]);
  parts.push(a.audienceSummary ?? 'Whole condo');
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
  statsLine,
}: {
  notice: Announcement;
  selected: boolean;
  onSelect: () => void;
  statsLine?: string | null;
}) {
  const status = notice.status ?? announcementStatus(notice);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`ann-list-row ${selected ? 'ann-list-row-active' : 'ann-list-row-idle'}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <AnnouncementListTitle className="truncate">{notice.title}</AnnouncementListTitle>
          <AnnouncementMetaLine className="mt-1 truncate">
            {noticeMetaLine(notice)}
          </AnnouncementMetaLine>
          {statsLine ? <p className="ann-stats-line mt-1.5">{statsLine}</p> : null}
        </div>
        <Badge tone={STATUS_TONE[status]} className="shrink-0 text-[11px]">
          {ANNOUNCEMENT_STATUS_LABELS[status]}
        </Badge>
        <ChevronRight className="size-4 shrink-0 text-[rgb(var(--sr-muted))] sm:size-5" />
      </div>
    </button>
  );
}

function AdminNoticeDetail({
  notice,
  onEdit,
  onTogglePublish,
  onRemove,
  updatePending,
  removePending,
}: {
  notice: Announcement;
  onEdit: () => void;
  onTogglePublish: () => void;
  onRemove: () => void;
  updatePending: boolean;
  removePending: boolean;
}) {
  const stats = useAnnouncementReadStats(api, notice.id);
  const status = notice.status ?? announcementStatus(notice);
  const isLive = status === 'PUBLISHED';
  const toggleLabel = isLive ? 'Unpublish' : status === 'SCHEDULED' ? 'Publish now' : 'Publish';
  const s = stats.data;
  const statsLine =
    s && s.recipientCount > 0
      ? `${s.readCount} read · ${s.readPercent}% read`
      : s
        ? 'No audience recipients yet'
        : null;
  return (
    <AnnouncementSurface className="p-5 sm:p-6">
      <AnnouncementHero className="mb-5 sm:mb-6 !p-4 sm:!p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[status]}>{ANNOUNCEMENT_STATUS_LABELS[status]}</Badge>
              <Badge tone="neutral">{ANNOUNCEMENT_CATEGORY_LABELS[notice.category]}</Badge>
            </div>
            <AnnouncementDetailTitle>{notice.title}</AnnouncementDetailTitle>
            <AnnouncementMetaLine className="mt-2">{noticeMetaLine(notice)}</AnnouncementMetaLine>
            {stats.isLoading ? (
              <Skeleton className="mt-3 h-4 w-48" />
            ) : statsLine ? (
              <p className="ann-stats-line mt-3">{statsLine}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="secondary" size="sm" disabled={updatePending} onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={updatePending}
              onClick={onTogglePublish}
            >
              {toggleLabel}
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
  const [categoryFilter, setCategoryFilter] = React.useState<ListFilter>('');
  const [insightsSort, setInsightsSort] = React.useState<InsightsSort>('date');
  const isInsights = categoryFilter === 'insights';
  const list = useCondoAnnouncements(api, condoId, {
    manage: true,
    category: isInsights ? undefined : categoryFilter || undefined,
    includeStats: isInsights,
  });
  const blocks = useCondoBlocks(api, condoId);
  const create = useCreateAnnouncement(api);
  const update = useUpdateAnnouncement(api);
  const remove = useDeleteAnnouncement(api);

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
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
  const [publishMode, setPublishMode] = React.useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [hasExpiry, setHasExpiry] = React.useState(false);
  const [expiresAt, setExpiresAt] = React.useState('');
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
  const visibleItems = React.useMemo(() => {
    if (!isInsights) return items;
    const live = items.filter((a) => (a.status ?? announcementStatus(a)) === 'PUBLISHED');
    return [...live].sort((a, b) => {
      if (insightsSort === 'readRate') {
        const ar = a.readStats?.readPercent ?? 0;
        const br = b.readStats?.readPercent ?? 0;
        if (br !== ar) return br - ar;
      }
      const ad = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bd = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bd - ad;
    });
  }, [insightsSort, isInsights, items]);
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
    setPublishMode('now');
    setScheduledAt('');
    setHasExpiry(false);
    setExpiresAt('');
    setImageIds([]);
    setPdfMemo(null);
    photoRef.current?.reset();
  }

  function openCompose() {
    setComposeOpen(true);
    setEditingId(null);
    setSelectedId(null);
    resetForm();
    requestAnimationFrame(() => {
      composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function closeCompose() {
    setComposeOpen(false);
    resetForm();
  }

  function loadNoticeIntoForm(notice: Announcement) {
    setTitle(notice.title);
    setBody(notice.body);
    setImportance(notice.importance);
    setCategory(notice.category);
    setAudienceScope(notice.audienceScope ?? 'CONDO');
    setSelectedBlockIds(notice.audienceBlocks?.map((b) => b.id) ?? []);
    setSelectedUnitIds(notice.audienceUnits?.map((u) => u.id) ?? []);
    setUnitSearch('');
    setPinned(notice.pinned);
    setRequiresAck(notice.requiresAck);
    setImageIds([]);
    setPdfMemo(null);
    photoRef.current?.reset();

    const status = notice.status ?? announcementStatus(notice);
    if (!notice.publishedAt) {
      setPublishMode('now');
      setScheduledAt('');
    } else if (status === 'SCHEDULED') {
      setPublishMode('schedule');
      setScheduledAt(toDatetimeLocal(notice.publishedAt));
    } else {
      setPublishMode('now');
      setScheduledAt('');
    }

    if (notice.expiresAt) {
      setHasExpiry(true);
      setExpiresAt(toDatetimeLocal(notice.expiresAt));
    } else {
      setHasExpiry(false);
      setExpiresAt('');
    }
  }

  function openEdit(notice: Announcement) {
    setComposeOpen(false);
    setEditingId(notice.id);
    setSelectedId(notice.id);
    loadNoticeIntoForm(notice);
    requestAnimationFrame(() => {
      composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function closeEdit() {
    setEditingId(null);
    resetForm();
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !title.trim() || !body.trim()) {
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

    const notice = items.find((a) => a.id === editingId);
    const currentStatus = notice ? (notice.status ?? announcementStatus(notice)) : 'DRAFT';

    let publishedAt: Date | null | undefined;
    if (publishMode === 'schedule') {
      if (!scheduledAt) {
        toast.error('Pick a date and time to schedule');
        return;
      }
      publishedAt = new Date(scheduledAt);
      if (publishedAt.getTime() <= Date.now()) {
        toast.error('Scheduled time must be in the future');
        return;
      }
    } else if (currentStatus === 'PUBLISHED' || currentStatus === 'EXPIRED') {
      publishedAt = notice?.publishedAt ? new Date(notice.publishedAt) : undefined;
    } else {
      publishedAt = new Date();
    }

    let expiry: Date | null | undefined;
    if (hasExpiry) {
      if (!expiresAt) {
        toast.error('Pick an expiry date and time');
        return;
      }
      expiry = new Date(expiresAt);
      const base =
        publishMode === 'schedule' && scheduledAt
          ? new Date(scheduledAt)
          : notice?.publishedAt
            ? new Date(notice.publishedAt)
            : new Date();
      if (expiry.getTime() <= base.getTime()) {
        toast.error('Expiry must be after the publish time');
        return;
      }
    } else {
      expiry = null;
    }

    try {
      await update.mutateAsync({
        id: editingId,
        data: {
          title: title.trim(),
          body: body.trim(),
          importance,
          category,
          audienceScope,
          blockIds: audienceScope === 'BLOCKS' ? selectedBlockIds : [],
          unitIds: audienceScope === 'UNITS' ? selectedUnitIds : [],
          publishedAt,
          expiresAt: expiry,
          pinned,
          requiresAck,
        },
      });
      toast.success('Notice updated');
      closeEdit();
    } catch (err) {
      toast.error((err as Error).message);
    }
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

    let publishedAt: Date | undefined;
    if (publishMode === 'schedule') {
      if (!scheduledAt) {
        toast.error('Pick a date and time to schedule');
        return;
      }
      publishedAt = new Date(scheduledAt);
      if (publishedAt.getTime() <= Date.now()) {
        toast.error('Scheduled time must be in the future');
        return;
      }
    }

    let expiry: Date | undefined;
    if (hasExpiry) {
      if (!expiresAt) {
        toast.error('Pick an expiry date and time');
        return;
      }
      expiry = new Date(expiresAt);
      const base = publishedAt ?? new Date();
      if (expiry.getTime() <= base.getTime()) {
        toast.error('Expiry must be after the publish time');
        return;
      }
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
        publishedAt,
        expiresAt: expiry,
        pinned,
        requiresAck,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      });
      toast.success(publishMode === 'schedule' ? 'Notice scheduled' : 'Notice published');
      resetForm();
      setComposeOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onTogglePublish(a: Announcement) {
    const status = a.status ?? announcementStatus(a);
    const unpublish = status === 'PUBLISHED';
    try {
      await update.mutateAsync({
        id: a.id,
        data: { publishedAt: unpublish ? null : new Date() },
      });
      toast.success(unpublish ? 'Moved to draft' : 'Published');
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
        message.includes('fetch') ? 'Could not reach the server — is the API running?' : message,
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
          !composeOpen && !editingId ? (
            <Button className="w-full sm:w-auto" onClick={openCompose}>
              <Plus className="size-4" />
              New notice
            </Button>
          ) : undefined
        }
      />

      {composeOpen || editingId ? (
        <Card
          ref={composeRef}
          className="ann-surface !rounded-2xl !p-5 sm:!p-7 shadow-card border-[rgb(var(--sr-border))]/75"
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="ann-eyebrow mb-1">{editingId ? 'Edit' : 'Compose'}</p>
              <h3 className="ann-detail-title text-xl sm:text-2xl">
                {editingId ? 'Edit notice' : 'New notice'}
              </h3>
              <p className="ann-page-subtitle mt-2 !max-w-none">
                {editingId
                  ? 'Update the notice content or audience. Live notices stay live — residents are not re-notified for text edits.'
                  : 'Choose who sees it, write a short summary, then attach the official memo if you have one.'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Close"
              onClick={editingId ? closeEdit : closeCompose}
            >
              <X className="size-4" />
            </Button>
          </div>

          <form className="flex flex-col gap-6" onSubmit={editingId ? onSaveEdit : onPublish}>
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
                          items.flatMap((n) => n.audienceUnits ?? []).find((x) => x.id === id)
                            ?.identifier ??
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

            {!editingId ? (
              <>
                <section className="flex flex-col gap-2">
                  <Label>Official memo (PDF, optional)</Label>
                  {pdfMemo ? (
                    <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/50 px-4 py-3">
                      <FileText className="size-5 shrink-0 text-[rgb(var(--sr-coral))]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{pdfMemo.fileName}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPdfMemo(null)}
                      >
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
              </>
            ) : null}

            <section className="flex flex-col gap-3">
              <div>
                <AnnouncementSectionLabel className="block text-sm normal-case tracking-normal font-medium text-[rgb(var(--sr-fg))]">
                  Publishing
                </AnnouncementSectionLabel>
                <p className="ann-meta mt-1">When should residents see this and get notified?</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {(
                  [
                    { value: 'now', label: 'Publish now', hint: 'Live immediately' },
                    { value: 'schedule', label: 'Schedule', hint: 'Go live at a set time' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex flex-1 items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                      publishMode === opt.value
                        ? 'border-[rgb(var(--sr-coral)/0.55)] bg-[rgb(var(--sr-coral)/0.05)]'
                        : 'border-[rgb(var(--sr-border))]/80 bg-[rgb(var(--sr-card))] hover:border-[rgb(var(--sr-coral)/0.25)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="publishMode"
                      className="mt-1"
                      checked={publishMode === opt.value}
                      onChange={() => setPublishMode(opt.value)}
                    />
                    <span>
                      <span className="text-sm font-medium block">{opt.label}</span>
                      <span className="text-xs sr-muted">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              {publishMode === 'schedule' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ann-schedule">Publish date &amp; time</Label>
                  <input
                    id="ann-schedule"
                    type="datetime-local"
                    className={selectCls}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-sm mt-1">
                <input
                  type="checkbox"
                  checked={hasExpiry}
                  onChange={(e) => setHasExpiry(e.target.checked)}
                />
                Auto-hide after an expiry date
              </label>
              {hasExpiry ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ann-expiry">Expiry date &amp; time</Label>
                  <input
                    id="ann-expiry"
                    type="datetime-local"
                    className={selectCls}
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs sr-muted">
                    Residents stop seeing the notice after this time. It stays here for your
                    records.
                  </p>
                </div>
              ) : null}
            </section>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
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
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={editingId ? closeEdit : closeCompose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={!title.trim() || !body.trim() || create.isPending || update.isPending}
              >
                {editingId
                  ? update.isPending
                    ? 'Saving…'
                    : 'Save changes'
                  : create.isPending
                    ? 'Saving…'
                    : publishMode === 'schedule'
                      ? 'Schedule notice'
                      : 'Publish notice'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <AnnouncementsAdminGrid
        detail={
          selected && !composeOpen && !editingId ? (
            <AdminNoticeDetail
              notice={selected}
              updatePending={update.isPending}
              removePending={remove.isPending}
              onEdit={() => openEdit(selected)}
              onTogglePublish={() => void onTogglePublish(selected)}
              onRemove={() => void onRemove(selected.id, selected.title)}
            />
          ) : undefined
        }
        list={
          <div>
            <AnnouncementSectionLabel className="mb-3 sm:mb-4 block text-sm normal-case tracking-normal font-semibold text-[rgb(var(--sr-fg))]">
              {isInsights ? 'Live notice metrics' : 'All notices'}
            </AnnouncementSectionLabel>
            <AnnouncementCategoryFilter
              className="mb-4"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={CATEGORY_OPTIONS}
              showInsights
            />
            {isInsights ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs sr-muted">Sort by</span>
                <button
                  type="button"
                  className={`ann-filter-tab ${insightsSort === 'date' ? 'ann-filter-tab-active' : ''}`}
                  onClick={() => setInsightsSort('date')}
                >
                  Newest first
                </button>
                <button
                  type="button"
                  className={`ann-filter-tab ${insightsSort === 'readRate' ? 'ann-filter-tab-active' : ''}`}
                  onClick={() => setInsightsSort('readRate')}
                >
                  Read rate
                </button>
              </div>
            ) : null}
            {list.isLoading ? (
              <Skeleton className="h-28 rounded-2xl" />
            ) : visibleItems.length === 0 ? (
              <EmptyState
                title={isInsights ? 'No live notices yet' : 'No notices yet'}
                description={
                  isInsights
                    ? 'Published notices appear here with read counts scoped to their audience.'
                    : 'Create your first notice — residents will only see published items that match their unit or block.'
                }
              />
            ) : (
              <ul className="flex flex-col gap-2 sm:gap-2.5">
                {visibleItems.map((a) => (
                  <li key={a.id}>
                    <AdminNoticeRow
                      notice={a}
                      selected={selectedId === a.id}
                      onSelect={() => setSelectedId((prev) => (prev === a.id ? null : a.id))}
                      statsLine={isInsights ? readStatsLine(a.readStats) : null}
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
