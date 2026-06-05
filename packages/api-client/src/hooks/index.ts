'use client';

import type { CreateDefectInput, CreateVisitorInput } from '@smartresidence/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient, CreateThreadBody, ListThreadsParams } from '../client';

export const queryKeys = {
  me: ['me'] as const,
  myCondos: ['condos', 'mine'] as const,
  myUnits: ['units', 'mine'] as const,
  unitVisitors: (unitId: string) => ['visitors', 'unit', unitId] as const,
  condoVisitors: (condoId: string) => ['visitors', 'condo', condoId] as const,
  unitInvoices: (unitId: string) => ['invoices', 'unit', unitId] as const,
  invoice: (id: string) => ['invoices', id] as const,
  unitDefects: (unitId: string) => ['defects', 'unit', unitId] as const,
  condoDefects: (condoId: string) => ['defects', 'condo', condoId] as const,
  defect: (id: string) => ['defects', id] as const,
  condoAnnouncements: (condoId: string) => ['announcements', 'condo', condoId] as const,
  myActivity: ['audit', 'me', 'activity'] as const,
  whoViewedMe: ['audit', 'me', 'who-viewed'] as const,
  threads: (params: ListThreadsParams) => ['threads', params] as const,
  thread: (id: string) => ['threads', id] as const,
  faqArticles: (condoId: string, q: string) => ['faq', 'condo', condoId, q] as const,
  faqCategories: (condoId: string) => ['faq', 'categories', condoId] as const,
  faqManage: (condoId: string) => ['faq', 'manage', condoId] as const,
  faqArticle: (id: string) => ['faq', 'article', id] as const,
};

export function useMe(api: ApiClient) {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.me() });
}

export function useMyCondos(api: ApiClient) {
  return useQuery({ queryKey: queryKeys.myCondos, queryFn: () => api.myCondos() });
}

export function useMyUnits(api: ApiClient) {
  return useQuery({ queryKey: queryKeys.myUnits, queryFn: () => api.myUnits() });
}

export function useUnitVisitors(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitVisitors(unitId) : ['visitors', 'unit', null],
    queryFn: () =>
      unitId ? api.visitorsForUnit(unitId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
  });
}

export function useCreateVisitor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVisitorInput) => api.createVisitor(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitVisitors(vars.unitId) });
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

export function useCondoAnnouncements(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoAnnouncements(condoId) : ['announcements', 'condo', null],
    queryFn: () =>
      condoId ? api.announcementsForCondo(condoId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
  });
}

export function useAckAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.ackAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.thread(vars.id) });
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

export function useUpdateThread(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      priority?: import('../client').ThreadPriority;
      status?: import('../client').ThreadStatus;
      assignedToUserId?: string;
    }) =>
      api.updateThread(vars.id, {
        priority: vars.priority,
        status: vars.status,
        assignedToUserId: vars.assignedToUserId,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.thread(vars.id) });
      qc.invalidateQueries({ queryKey: ['threads'] });
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
