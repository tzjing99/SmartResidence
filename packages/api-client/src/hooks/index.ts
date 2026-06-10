'use client';

import type {
  CreateDefectInput,
  CreateFavouriteVisitorInput,
  CreateVisitorInput,
} from '@smartresidence/shared-types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnnouncementDetail,
  AnnouncementSummary,
  ApiClient,
  CreateAnnouncementBody,
  CreateThreadBody,
  ListAnnouncementsParams,
  ListThreadsParams,
  ThreadDetail,
  ThreadMessageItem,
  UpdateAnnouncementBody,
} from '../client';
import { patchAnnouncementReadInListCaches } from '../realtime/announcement-cache';
import { patchThreadInListCaches } from '../realtime/thread-cache';

/** Identity / tenancy — stable for the logged-in session. */
const STABLE_SESSION_MS = 5 * 60_000;
/** List views kept fresh via realtime or explicit mutations. */
const LIST_VIEW_MS = 30_000;

export const queryKeys = {
  me: ['me'] as const,
  myCondos: ['condos', 'mine'] as const,
  myUnits: ['units', 'mine'] as const,
  condoUnits: (
    condoId: string,
    params: { limit?: number; offset?: number; search?: string } = {},
  ) => ['units', 'condo', condoId, params] as const,
  unitVisitors: (unitId: string, view?: string) =>
    ['visitors', 'unit', unitId, view ?? 'all'] as const,
  condoVisitors: (
    condoId: string,
    params?: {
      view?: string;
      filter?: string;
      search?: string;
      status?: string;
      unitId?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    },
  ) => ['visitors', 'condo', condoId, params ?? {}] as const,
  visitorAdminStats: (condoId: string) => ['visitors', 'admin', 'stats', condoId] as const,
  guardLiveVisitors: (condoId: string) => ['visitors', 'guard', 'live', condoId] as const,
  unitFavouriteVisitors: (unitId: string) => ['visitors', 'favourites', unitId] as const,
  unitInvoices: (unitId: string) => ['invoices', 'unit', unitId] as const,
  invoice: (id: string) => ['invoices', id] as const,
  unitDefects: (unitId: string) => ['defects', 'unit', unitId] as const,
  condoDefects: (condoId: string) => ['defects', 'condo', condoId] as const,
  defect: (id: string) => ['defects', id] as const,
  condoAnnouncements: (condoId: string, params: ListAnnouncementsParams = {}) =>
    ['announcements', 'condo', condoId, params] as const,
  announcement: (id: string) => ['announcements', id] as const,
  manageAnnouncements: (condoId: string, params: ListAnnouncementsParams = {}) =>
    ['announcements', 'manage', condoId, params] as const,
  myActivity: ['audit', 'me', 'activity'] as const,
  whoViewedMe: ['audit', 'me', 'who-viewed'] as const,
  threads: (params: ListThreadsParams) => ['threads', params] as const,
  thread: (id: string) => ['threads', id] as const,
  faqArticles: (condoId: string, q: string) => ['faq', 'condo', condoId, q] as const,
  faqCategories: (condoId: string) => ['faq', 'categories', condoId] as const,
  faqManage: (condoId: string) => ['faq', 'manage', condoId] as const,
  faqArticle: (id: string) => ['faq', 'article', id] as const,
  slaSettings: (condoId: string) => ['sla', 'settings', condoId] as const,
  slaAudit: (condoId: string) => ['sla', 'audit', condoId] as const,
  condoVisitorSettings: (condoId: string) => ['settings', 'visitor', condoId] as const,
  overnightUnitSummary: (condoId: string, month?: string) =>
    ['visitors', 'overnight-summary', condoId, month ?? 'current'] as const,
  preferences: ['auth', 'preferences'] as const,
};

function syncThreadAfterMutation(
  qc: ReturnType<typeof useQueryClient>,
  api: ApiClient,
  threadId: string,
  summary?: import('../client').ThreadSummary,
) {
  if (summary) {
    qc.setQueryData<ThreadDetail>(queryKeys.thread(threadId), (old) =>
      old ? { ...old, ...summary } : old,
    );
    patchThreadInListCaches(qc, summary);
  }
  void qc
    .fetchQuery({
      queryKey: queryKeys.thread(threadId),
      queryFn: () => api.thread(threadId),
    })
    .then((detail) => patchThreadInListCaches(qc, detail));
}

export function useMe(api: ApiClient, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.me(),
    enabled: options?.enabled ?? true,
    staleTime: STABLE_SESSION_MS,
    // Auth failures should redirect immediately — don't spin retrying 401/500.
    retry: false,
  });
}

export function useMyCondos(api: ApiClient, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.myCondos,
    queryFn: () => api.myCondos(),
    enabled: options?.enabled ?? true,
    staleTime: STABLE_SESSION_MS,
  });
}

export function useMyUnits(api: ApiClient) {
  return useQuery({
    queryKey: queryKeys.myUnits,
    queryFn: () => api.myUnits(),
    staleTime: STABLE_SESSION_MS,
  });
}

export function useListUnits(
  api: ApiClient,
  condoId: string | null,
  params: { limit?: number; offset?: number; search?: string } = {},
) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoUnits(condoId, params) : ['units', 'condo', null],
    queryFn: () =>
      condoId ? api.listUnits(condoId, params) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: STABLE_SESSION_MS,
  });
}

export function useVisitorAdminStats(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.visitorAdminStats(condoId) : ['visitors', 'admin', 'stats', null],
    queryFn: () =>
      condoId ? api.visitorAdminStats(condoId) : Promise.reject(new Error('no condo')),
    enabled: Boolean(condoId),
    staleTime: 60_000,
  });
}

export function useUnitVisitors(
  api: ApiClient,
  unitId: string | null,
  view?: import('@smartresidence/shared-types').VisitorListView,
) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitVisitors(unitId, view) : ['visitors', 'unit', null],
    queryFn: () =>
      unitId
        ? api.visitorsForUnit(unitId, view ? { view } : {})
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
    staleTime: LIST_VIEW_MS,
    placeholderData: keepPreviousData,
  });
}

export function useCreateVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVisitorInput) => api.createVisitor(input),
    onSuccess: (_data, vars) => {
      // Prefix only — unitVisitors(unitId) defaults view to 'all' and misses upcoming/live/history keys.
      qc.invalidateQueries({ queryKey: ['visitors', 'unit', vars.unitId] });
    },
  });
}

export function useOvernightPreview(
  api: ApiClient,
  condoId: string | null,
  expectedAt: Date | null,
  overnight: boolean,
) {
  return useQuery({
    queryKey: [
      'visitors',
      'overnight-preview',
      condoId,
      expectedAt?.toISOString(),
      overnight,
    ] as const,
    queryFn: () =>
      condoId && expectedAt
        ? api.overnightPreview(condoId, expectedAt)
        : Promise.reject(new Error('missing params')),
    enabled: Boolean(condoId && expectedAt && overnight),
  });
}

export function useApproveOvernightVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitorId: string) => api.approveOvernightVisitor(visitorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

export function useVisitorQr(api: ApiClient, visitorId: string | null) {
  return useQuery({
    queryKey: ['visitors', visitorId, 'qr'] as const,
    queryFn: () => (visitorId ? api.visitorQr(visitorId) : Promise.reject(new Error('no id'))),
    enabled: Boolean(visitorId),
  });
}

export function useApproveVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitorId: string) => api.approveVisitor(visitorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

export function useGuardApproveWalkIn(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      visitorId: string;
      method: import('@smartresidence/shared-types').GuardApprovalMethod;
    }) => api.guardApproveWalkIn(vars.visitorId, vars.method),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

export function useGuardAcknowledgeWalkIn(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitorId: string) =>
      api.acknowledgeWalkIn(visitorId, { gateLocation: 'Main gate' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

export function useRejectVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { visitorId: string; reason?: string }) =>
      api.rejectVisitor(vars.visitorId, vars.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

export function useCancelVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { visitorId: string; unitId: string }) => api.cancelVisitor(vars.visitorId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['visitors', 'unit', vars.unitId] });
      qc.invalidateQueries({ queryKey: ['visitors', vars.visitorId] });
    },
  });
}

export function useFavouriteVisitors(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitFavouriteVisitors(unitId) : ['visitors', 'favourites', null],
    queryFn: () =>
      unitId ? api.favouriteVisitorsForUnit(unitId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
    staleTime: STABLE_SESSION_MS,
  });
}

export function useCreateFavouriteVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFavouriteVisitorInput) => api.createFavouriteVisitor(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitFavouriteVisitors(vars.unitId) });
    },
  });
}

export function useDeleteFavouriteVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; unitId: string }) => api.deleteFavouriteVisitor(vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitFavouriteVisitors(vars.unitId) });
    },
  });
}

export function useUnitInvoices(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitInvoices(unitId) : ['invoices', 'unit', null],
    queryFn: () =>
      unitId ? api.invoicesForUnit(unitId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
  });
}

export function usePayInvoice(api: ApiClient) {
  return useMutation({
    mutationFn: (vars: { id: string; provider: string; returnUrl?: string }) =>
      api.payInvoice(vars.id, { provider: vars.provider, returnUrl: vars.returnUrl }),
  });
}

export function useUnitDefects(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitDefects(unitId) : ['defects', 'unit', null],
    queryFn: () => (unitId ? api.defectsForUnit(unitId) : Promise.resolve({ items: [], total: 0 })),
    enabled: Boolean(unitId),
  });
}

export function useCondoDefects(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoDefects(condoId) : ['defects', 'condo', null],
    queryFn: () =>
      condoId ? api.defectsForCondo(condoId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
  });
}

export function useCreateDefect(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDefectInput) => api.createDefect(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitDefects(vars.unitId) });
    },
  });
}

export function useTransitionDefect(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      status: string;
      message?: string;
      assignedToUserId?: string;
    }) =>
      api.transitionDefect(vars.id, {
        status: vars.status,
        message: vars.message,
        assignedToUserId: vars.assignedToUserId,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.defect(vars.id) });
      qc.invalidateQueries({ queryKey: ['defects'] });
    },
  });
}

export function useCondoAnnouncements(
  api: ApiClient,
  condoId: string | null,
  params: ListAnnouncementsParams = {},
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.condoAnnouncements(condoId, params)
      : ['announcements', 'condo', null],
    queryFn: () =>
      condoId
        ? api.listAnnouncements(condoId, params)
        : Promise.resolve({ items: [], total: 0, unreadCount: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
    placeholderData: keepPreviousData,
  });
}

export function useAnnouncement(api: ApiClient, id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: id ? queryKeys.announcement(id) : ['announcements', null],
    queryFn: async () => {
      if (!id) throw new Error('Announcement id is required');
      const data = await api.announcement(id);
      patchAnnouncementReadInListCaches(qc, data.id, data.readAt ?? new Date().toISOString());
      return data;
    },
    enabled: Boolean(id),
    staleTime: LIST_VIEW_MS,
  });
}

export function useManageAnnouncements(
  api: ApiClient,
  condoId: string | null,
  params: ListAnnouncementsParams = {},
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.manageAnnouncements(condoId, params)
      : ['announcements', 'manage', null],
    queryFn: () =>
      condoId ? api.manageAnnouncements(condoId, params) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
    placeholderData: keepPreviousData,
  });
}

export function useCreateAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAnnouncementBody) => api.createAnnouncement(body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['announcements', 'manage', data.condoId] });
      qc.invalidateQueries({ queryKey: ['announcements', 'condo', data.condoId] });
    },
  });
}

export function useUpdateAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateAnnouncementBody }) =>
      api.updateAnnouncement(vars.id, vars.body),
    onSuccess: (data) => {
      qc.setQueryData<AnnouncementDetail>(queryKeys.announcement(data.id), data);
      qc.invalidateQueries({ queryKey: ['announcements', 'manage', data.condoId] });
      qc.invalidateQueries({ queryKey: ['announcements', 'condo', data.condoId] });
    },
  });
}

type AnnouncementListCache = {
  items: Array<AnnouncementDetail | AnnouncementSummary>;
  total?: number;
  unreadCount?: number;
  limit?: number;
  offset?: number;
};

function removeAnnouncementFromListCaches(
  qc: ReturnType<typeof useQueryClient>,
  announcementId: string,
) {
  qc.setQueriesData<AnnouncementListCache>({ queryKey: ['announcements'] }, (old) => {
    if (!old || !Array.isArray(old.items)) return old;
    const removed = old.items.find((a) => a.id === announcementId);
    if (!removed) return old;
    return {
      ...old,
      total: Math.max(0, (old.total ?? old.items.length) - 1),
      unreadCount:
        old.unreadCount !== undefined && !removed.readAt
          ? Math.max(0, old.unreadCount - 1)
          : old.unreadCount,
      items: old.items.filter((a) => a.id !== announcementId),
    };
  });
}

export function useDeleteAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; condoId: string }) => api.deleteAnnouncement(vars.id),
    onSuccess: (_data, vars) => {
      removeAnnouncementFromListCaches(qc, vars.id);
      qc.removeQueries({ queryKey: queryKeys.announcement(vars.id) });
      qc.invalidateQueries({ queryKey: ['announcements', 'manage', vars.condoId] });
      qc.invalidateQueries({ queryKey: ['announcements', 'condo', vars.condoId] });
    },
  });
}

export function useMarkAnnouncementRead(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markAnnouncementRead(id),
    onSuccess: (_data, id) => {
      patchAnnouncementReadInListCaches(qc, id);
      qc.setQueryData<AnnouncementDetail>(queryKeys.announcement(id), (old) =>
        old ? { ...old, readAt: new Date().toISOString() } : old,
      );
    },
  });
}

export function useAckAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.ackAnnouncement(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.announcement(id) });
    },
  });
}

export function useMyActivity(api: ApiClient) {
  return useQuery({
    queryKey: queryKeys.myActivity,
    queryFn: () => api.myActivity(),
  });
}

export function useWhoViewedMe(api: ApiClient) {
  return useQuery({
    queryKey: queryKeys.whoViewedMe,
    queryFn: () => api.whoViewedMe(),
  });
}

// -- Threads ---------------------------------------------------------

export function useThreads(api: ApiClient, params: ListThreadsParams = {}) {
  return useQuery({
    queryKey: queryKeys.threads(params),
    queryFn: () => api.listThreads(params),
    staleTime: LIST_VIEW_MS,
    placeholderData: keepPreviousData,
  });
}

export function useThread(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.thread(id) : ['threads', null],
    queryFn: () => (id ? api.thread(id) : Promise.reject(new Error('no id'))),
    enabled: Boolean(id),
  });
}

export function useCreateThread(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThreadBody) => api.createThread(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threads'] }),
  });
}

export function usePostThreadMessage(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      body: string;
      internalNote?: boolean;
      attachmentIds?: string[];
    }) =>
      api.postThreadMessage(vars.id, {
        body: vars.body,
        internalNote: vars.internalNote,
        attachmentIds: vars.attachmentIds,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.thread(vars.id) });
      const previous = qc.getQueryData<ThreadDetail>(queryKeys.thread(vars.id));
      const me = qc.getQueryData(queryKeys.me) as
        | { user?: { id: string; name: string } }
        | undefined;
      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: ThreadMessageItem = {
        id: optimisticId,
        threadId: vars.id,
        kind: vars.internalNote ? 'INTERNAL_NOTE' : 'MESSAGE',
        body: vars.body,
        createdAt: new Date().toISOString(),
        author: me?.user ? { id: me.user.id, name: me.user.name } : undefined,
      };
      qc.setQueryData<ThreadDetail>(queryKeys.thread(vars.id), (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...old.messages, optimistic],
          lastMessageAt: optimistic.createdAt,
          _count: { messages: (old._count?.messages ?? old.messages.length) + 1 },
        };
      });
      return { previous, optimisticId };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.thread(vars.id), context.previous);
      }
    },
    onSuccess: (data, vars, context) => {
      qc.setQueryData<ThreadDetail>(queryKeys.thread(vars.id), (old) => {
        if (!old) return old;
        const withoutOptimistic = old.messages.filter((m) => m.id !== context?.optimisticId);
        const hasReal = withoutOptimistic.some((m) => m.id === data.id);
        return {
          ...old,
          messages: hasReal ? withoutOptimistic : [...withoutOptimistic, data],
          lastMessageAt: data.createdAt,
        };
      });
      qc.setQueriesData<{ items: import('../client').ThreadSummary[]; total: number }>(
        { queryKey: ['threads'] },
        (old) => {
          // ['threads'] also matches the detail cache (no `items`); skip non-list caches.
          if (!old || !Array.isArray(old.items)) return old;
          return {
            ...old,
            items: old.items.map((t) =>
              t.id === vars.id ? { ...t, lastMessageAt: data.createdAt } : t,
            ),
          };
        },
      );
    },
  });
}

export function useUpdateThread(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      priority?: import('../client').ThreadPriority;
      category?: import('../client').ThreadCategory;
      status?: import('../client').ThreadStatus;
      assignedToUserId?: string;
    }) =>
      api.updateThread(vars.id, {
        priority: vars.priority,
        category: vars.category,
        status: vars.status,
        assignedToUserId: vars.assignedToUserId,
      }),
    onSuccess: (data, vars) => {
      syncThreadAfterMutation(qc, api, vars.id, data);
    },
  });
}

export function useProposeThreadResolution(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; note?: string; messageId?: string }) =>
      api.proposeThreadResolution(vars.id, { note: vars.note, messageId: vars.messageId }),
    onSuccess: (data, vars) => {
      syncThreadAfterMutation(qc, api, vars.id, data);
    },
  });
}

export function useConfirmThreadResolution(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      confirmed: boolean;
      rejectReason?: string;
      rejectExpectation?: string;
    }) =>
      api.confirmThreadResolution(vars.id, {
        confirmed: vars.confirmed,
        rejectReason: vars.rejectReason,
        rejectExpectation: vars.rejectExpectation,
      }),
    onSuccess: (data, vars) => {
      syncThreadAfterMutation(qc, api, vars.id, data);
    },
  });
}

export function useAppealThread(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      api.appealThread(vars.id, { reason: vars.reason }),
    onSuccess: (data, vars) => {
      syncThreadAfterMutation(qc, api, vars.id, data);
    },
  });
}

export function useSlaSettings(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.slaSettings(condoId) : ['sla', 'settings', null],
    queryFn: () => (condoId ? api.slaSettings(condoId) : Promise.reject(new Error('no condo'))),
    enabled: Boolean(condoId),
    staleTime: STABLE_SESSION_MS,
  });
}

export function useUpdateSlaSettings(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      policies: Array<{ priority: import('../client').ThreadPriority; resolutionMins: number }>;
      resolutionConfirmationGraceDays?: number;
      riskyAcknowledged?: boolean;
      rationale?: string;
    }) => api.updateSlaSettings(vars.condoId, vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.slaSettings(vars.condoId) });
      qc.invalidateQueries({ queryKey: queryKeys.slaAudit(vars.condoId) });
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

export function useSlaAudit(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.slaAudit(condoId) : ['sla', 'audit', null],
    queryFn: () => (condoId ? api.slaAudit(condoId) : Promise.reject(new Error('no condo'))),
    enabled: Boolean(condoId),
  });
}

export function useCondoVisitorSettings(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoVisitorSettings(condoId) : ['settings', 'visitor', null],
    queryFn: () =>
      condoId ? api.condoVisitorSettings(condoId) : Promise.reject(new Error('no condo')),
    enabled: Boolean(condoId),
    staleTime: STABLE_SESSION_MS,
  });
}

export function useGuardWalkInPolicy(api: ApiClient) {
  return useQuery({
    queryKey: ['visitors', 'guard', 'walk-in-policy'],
    queryFn: () => api.guardWalkInPolicy(),
  });
}

export function useUpdateCondoVisitorSettings(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      data: import('@smartresidence/shared-types').UpdateCondoVisitorSettingsInput;
    }) => api.updateCondoVisitorSettings(vars.condoId, vars.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.condoVisitorSettings(vars.condoId) });
      qc.invalidateQueries({ queryKey: ['visitors', 'overnight-summary', vars.condoId] });
    },
  });
}

export function useOvernightUnitSummary(api: ApiClient, condoId: string | null, month?: string) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.overnightUnitSummary(condoId, month)
      : ['visitors', 'overnight-summary', null],
    queryFn: () =>
      condoId ? api.overnightUnitSummary(condoId, month) : Promise.reject(new Error('no condo')),
    enabled: Boolean(condoId),
  });
}

export function useSuspendUnitOvernight(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      unitId: string;
      reason: string;
      until?: string;
      indefinite?: boolean;
    }) => api.suspendUnitOvernight(vars.condoId, vars.unitId, vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['visitors', 'overnight-summary', vars.condoId] });
    },
  });
}

export function useUnsuspendUnitOvernight(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; unitId: string }) =>
      api.unsuspendUnitOvernight(vars.condoId, vars.unitId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['visitors', 'overnight-summary', vars.condoId] });
    },
  });
}

export function useFlagPlateMismatch(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { visitorId: string; reason?: string; suspendOwner?: boolean }) =>
      api.flagVisitorPlateMismatch(vars.visitorId, vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

export function useRequestThreadResident(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body?: string }) =>
      api.requestThreadResident(vars.id, { body: vars.body }),
    onSuccess: (data, vars) => {
      syncThreadAfterMutation(qc, api, vars.id, data);
    },
  });
}

// -- FAQ -------------------------------------------------------------

export function useFaqArticles(api: ApiClient, condoId: string | null, q = '') {
  return useQuery({
    queryKey: condoId ? queryKeys.faqArticles(condoId, q) : ['faq', 'condo', null, q],
    queryFn: () =>
      condoId
        ? api.faqArticles(condoId, { q: q || undefined })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
  });
}

export function useFaqCategories(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.faqCategories(condoId) : ['faq', 'categories', null],
    queryFn: () => (condoId ? api.faqCategories(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useFaqManageList(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.faqManage(condoId) : ['faq', 'manage', null],
    queryFn: () =>
      condoId ? api.faqManageList(condoId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
  });
}

export function useMarkFaqHelpful(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.faqHelpful(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faq'] }),
  });
}

export function useCreateFaqArticle(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      condoId: string;
      categoryId?: string;
      question: string;
      answer: string;
      tags?: string[];
      published?: boolean;
      pinned?: boolean;
    }) => api.createFaqArticle(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faq'] }),
  });
}

export function useUpdateFaqArticle(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      data: Partial<{
        categoryId: string;
        question: string;
        answer: string;
        tags: string[];
        published: boolean;
        pinned: boolean;
      }>;
    }) => api.updateFaqArticle(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faq'] }),
  });
}

export function useDeleteFaqArticle(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFaqArticle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faq'] }),
  });
}

export function useCreateFaqCategory(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { condoId: string; name: string; position?: number }) =>
      api.createFaqCategory(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faq'] }),
  });
}

export function useFaqDeflectMatch(api: ApiClient) {
  return useMutation({
    mutationFn: (body: { condoId: string; subject: string; body: string }) =>
      api.faqDeflectMatch(body),
  });
}

export function useUpdateAutoAssignment(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      generalTriagePool: string[];
      categoryPools: Array<{ category: import('../client').ThreadCategory; userIds: string[] }>;
      seniorStaffPool: string[];
    }) => api.updateAutoAssignment(vars.condoId, vars),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.slaSettings(vars.condoId) }),
  });
}

export function useUpdateMlPriority(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; enabled: boolean }) =>
      api.updateMlPriority(vars.condoId, { enabled: vars.enabled }),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.slaSettings(vars.condoId) }),
  });
}

export function useGuardLiveVisitors(api: ApiClient, condoId: string | undefined) {
  return useQuery({
    queryKey: condoId ? queryKeys.guardLiveVisitors(condoId) : ['visitors', 'guard', 'live', null],
    queryFn: () => api.guardLiveVisitors(),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
    // Socket `visitor:update` invalidates between polls; 15s was redundant with board timer.
    refetchInterval: 60_000,
  });
}

export function useCheckOutVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitorId: string) => api.checkOutVisitorById(visitorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitors'] });
    },
  });
}

export function usePreferences(api: ApiClient) {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => api.preferences(),
    staleTime: STABLE_SESSION_MS,
  });
}

export function useUpdatePreferences(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<ApiClient['updatePreferences']>[0]) =>
      api.updatePreferences(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.preferences }),
  });
}

export function useCloseAbusiveThread(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      api.closeAbusiveThread(vars.id, { reason: vars.reason }),
    onSuccess: (data, vars) => {
      syncThreadAfterMutation(qc, api, vars.id, data);
    },
  });
}
