'use client';

import type {
  BulkUpdateReportItemsInput,
  CastPollVoteInput,
  CastResolutionVoteInput,
  CreateAnnouncementInput,
  CreateBookingInput,
  CreateDefectElementInput,
  CreateDefectInput,
  CreateDefectIssueInput,
  CreateDefectSpaceTypeInput,
  CreateDeliveryPassInput,
  CreateFacilityInput,
  CreateFavouriteVisitorInput,
  CreateGeneralMeetingInput,
  CreateHandoverReportInput,
  CreateLostFoundPostInput,
  CreateMeetingResolutionInput,
  CreateParcelInput,
  CreatePatrolCheckpointInput,
  CreatePollInput,
  CreateUnitTypeInput,
  CreateUnitTypeSpaceInput,
  CreateVendorBillInput,
  CreateVendorInput,
  CreateVisitorInput,
  OpenResolutionVotingInput,
  PatrolScanInput,
  PublishMeetingMinutesInput,
  RaiseSosInput,
  SubmitMeetingProxyInput,
  UpdateAnnouncementInput,
  UpdateDefectElementInput,
  UpdateDefectIssueInput,
  UpdateDefectSpaceTypeInput,
  UpdateFacilityInput,
  UpdateGeneralMeetingInput,
  UpdatePatrolCheckpointInput,
  UpdatePollInput,
  UpdateUnitTypeInput,
  UpdateUnitTypeSpaceInput,
} from '@smartresidence/shared-types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiClient,
  CreateThreadBody,
  ListThreadsParams,
  ThreadDetail,
  ThreadMessageItem,
} from '../client';
import { patchThreadInListCaches } from '../realtime/thread-cache';

/** Identity / tenancy — stable for the logged-in session. */
const STABLE_SESSION_MS = 5 * 60_000;
/** List views kept fresh via realtime or explicit mutations. */
const LIST_VIEW_MS = 30_000;
/** Accounting reports that change slowly between billing runs. */
const REPORT_VIEW_MS = 3 * 60_000;

export const queryKeys = {
  me: ['me'] as const,
  myCondos: ['condos', 'mine'] as const,
  platformCondos: (params?: { search?: string; limit?: number; offset?: number }) =>
    ['platform', 'condos', params ?? {}] as const,
  platformCondoSummary: (condoId: string) => ['platform', 'condos', condoId, 'summary'] as const,
  platformCondoHealth: (condoId: string) => ['platform', 'condos', condoId, 'health'] as const,
  myUnits: ['units', 'mine'] as const,
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
  visitorBlacklist: (condoId: string) => ['visitors', 'blacklist', condoId] as const,
  unitRecurringPasses: (unitId: string) => ['visitors', 'recurring-passes', unitId] as const,
  unitFavouriteVisitors: (unitId: string) => ['visitors', 'favourites', unitId] as const,
  unitInvoices: (unitId: string) => ['invoices', 'unit', unitId] as const,
  condoInvoices: (condoId: string, status?: string) =>
    ['invoices', 'condo', condoId, status ?? 'all'] as const,
  invoice: (id: string) => ['invoices', id] as const,
  condoDeposits: (condoId: string, status?: string, unitId?: string) =>
    ['deposits', 'condo', condoId, status ?? 'all', unitId ?? 'all'] as const,
  unitDeposits: (unitId: string) => ['deposits', 'unit', unitId] as const,
  condoReceipts: (condoId: string, kind?: string) =>
    ['receipts', 'condo', condoId, kind ?? 'all'] as const,
  unitReceipts: (unitId: string) => ['receipts', 'unit', unitId] as const,
  feeRates: (condoId: string) => ['fee-rates', condoId] as const,
  receiptTemplate: (condoId: string) => ['receipt-template', condoId] as const,
  billingAutomation: (condoId: string) => ['billing-automation', condoId] as const,
  billingAutomationPreview: (condoId: string) => ['billing-automation-preview', condoId] as const,
  automationStatus: (condoId: string) => ['automations', 'status', condoId] as const,
  setupStatus: (condoId: string) => ['setup', 'status', condoId] as const,
  gateways: (condoId: string) => ['gateways', condoId] as const,
  eInvoiceConfig: (condoId: string) => ['einvoice', 'config', condoId] as const,
  whatsAppConfig: (condoId: string) => ['notifications', 'whatsapp', condoId] as const,
  eInvoice: (invoiceId: string) => ['einvoice', 'invoice', invoiceId] as const,
  mcpServers: (condoId: string) => ['integrations', 'mcp', condoId] as const,
  payableMethods: (condoId: string) => ['payment-methods', condoId] as const,
  feeExtraLines: (condoId: string) => ['fee-extra-lines', condoId] as const,
  fundBalances: (condoId: string) => ['accounting', 'fund-balances', condoId] as const,
  fundSummary: (condoId: string, from?: string, to?: string) =>
    ['accounting', 'fund-summary', condoId, from ?? '', to ?? ''] as const,
  incomeExpense: (condoId: string, from?: string, to?: string) =>
    ['accounting', 'income-expense', condoId, from ?? '', to ?? ''] as const,
  collections: (condoId: string, from?: string, to?: string) =>
    ['accounting', 'collections', condoId, from ?? '', to ?? ''] as const,
  arrears: (condoId: string) => ['accounting', 'arrears', condoId] as const,
  cobTemplates: (condoId: string, from?: string, to?: string) =>
    ['cob', 'templates', condoId, from ?? '', to ?? ''] as const,
  paymentIssues: (condoId: string) => ['accounting', 'payment-issues', condoId] as const,
  unitStatement: (unitId: string) => ['accounting', 'statement', unitId] as const,
  chartOfAccounts: (condoId: string) => ['gl', 'coa', condoId] as const,
  glJournals: (condoId: string, from?: string, to?: string) =>
    ['gl', 'journals', condoId, from ?? '', to ?? ''] as const,
  glJournal: (condoId: string, entryId: string) => ['gl', 'journal', condoId, entryId] as const,
  glBankAccounts: (condoId: string) => ['gl', 'bank-accounts', condoId] as const,
  bankImports: (condoId: string, accountId?: string) =>
    ['gl', 'bank-imports', condoId, accountId ?? ''] as const,
  bankWorksheet: (condoId: string, importId: string) =>
    ['gl', 'bank-worksheet', condoId, importId] as const,
  unitDefects: (unitId: string) => ['defects', 'unit', unitId] as const,
  condoDefects: (condoId: string) => ['defects', 'condo', condoId] as const,
  defect: (id: string) => ['defects', id] as const,
  unitTypes: (condoId: string) => ['unit-types', condoId] as const,
  defectTaxonomy: (condoId: string) => ['defect-taxonomy', condoId] as const,
  unitHandoverTemplate: (unitId: string) => ['handover-template', unitId] as const,
  defectReports: (condoId: string) => ['defect-reports', 'condo', condoId] as const,
  unitDefectReports: (unitId: string) => ['defect-reports', 'unit', unitId] as const,
  defectReport: (id: string) => ['defect-reports', id] as const,
  condoAnnouncements: (condoId: string) => ['announcements', 'condo', condoId] as const,
  condoPolls: (condoId: string) => ['polls', 'condo', condoId] as const,
  poll: (id: string) => ['polls', id] as const,
  condoMeetings: (condoId: string) => ['governance', 'condo', condoId] as const,
  meeting: (id: string) => ['governance', id] as const,
  condoFacilities: (condoId: string, includeInactive?: boolean) =>
    ['facilities', 'condo', condoId, includeInactive ? 'all' : 'active'] as const,
  facility: (id: string) => ['facilities', id] as const,
  facilityAvailability: (id: string, date: string) =>
    ['facilities', id, 'availability', date] as const,
  myBookings: ['bookings', 'mine'] as const,
  condoBookings: (condoId: string, params?: Record<string, unknown>) =>
    ['bookings', 'condo', condoId, params ?? {}] as const,
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
  sessions: ['auth', 'sessions'] as const,
  notifications: (unreadOnly?: boolean) =>
    ['notifications', { unreadOnly: unreadOnly ?? false }] as const,
  condoSosAlerts: (condoId: string) => ['sos', 'condo', condoId] as const,
  mySosAlerts: ['sos', 'mine'] as const,
  sosAlert: (id: string) => ['sos', id] as const,
  patrolCheckpoints: (condoId: string, includeInactive?: boolean) =>
    ['patrol', 'checkpoints', condoId, includeInactive ? 'all' : 'active'] as const,
  patrolScans: (condoId: string, params?: Record<string, unknown>) =>
    ['patrol', 'scans', condoId, params ?? {}] as const,
  condoParcels: (condoId: string, params?: Record<string, unknown>) =>
    ['parcels', 'condo', condoId, params ?? {}] as const,
  unitParcels: (unitId: string, params?: Record<string, unknown>) =>
    ['parcels', 'unit', unitId, params ?? {}] as const,
  parcel: (id: string) => ['parcels', id] as const,
  condoLostFound: (condoId: string, params?: Record<string, unknown>) =>
    ['lost-found', 'condo', condoId, params ?? {}] as const,
  myLostFound: (params?: Record<string, unknown>) => ['lost-found', 'mine', params ?? {}] as const,
  lostFoundPost: (id: string) => ['lost-found', id] as const,
  condoVendors: (condoId: string, params?: Record<string, unknown>) =>
    ['procurement', 'vendors', condoId, params ?? {}] as const,
  vendor: (id: string) => ['procurement', 'vendor', id] as const,
  condoVendorBills: (condoId: string, params?: Record<string, unknown>) =>
    ['procurement', 'bills', condoId, params ?? {}] as const,
  vendorBill: (id: string) => ['procurement', 'bill', id] as const,
  condoFormTemplates: (condoId: string, includeInactive?: boolean) =>
    ['forms', 'templates', condoId, includeInactive ? 'all' : 'active'] as const,
  formTemplate: (id: string) => ['forms', 'template', id] as const,
  myFormSubmissions: ['forms', 'mine'] as const,
  condoFormSubmissions: (condoId: string, params?: Record<string, unknown>) =>
    ['forms', 'submissions', condoId, params ?? {}] as const,
  formSubmission: (id: string) => ['forms', 'submission', id] as const,
  documentFolders: (condoId: string, includeInactive?: boolean) =>
    ['documents', 'folders', condoId, includeInactive ? 'all' : 'active'] as const,
  condoDocuments: (condoId: string, params?: { folderId?: string; includeInactive?: boolean }) =>
    ['documents', 'condo', condoId, params ?? {}] as const,
  document: (id: string) => ['documents', 'item', id] as const,
  documentVersions: (documentId: string) => ['documents', documentId, 'versions'] as const,
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

export function usePlatformCondos(
  api: ApiClient,
  params: { search?: string; limit?: number; offset?: number } = {},
  options?: { enabled?: boolean },
) {
  const search = params.search?.trim() || undefined;
  const queryParams = { search, limit: params.limit, offset: params.offset };
  return useQuery({
    queryKey: queryKeys.platformCondos(queryParams),
    queryFn: () => api.listPlatformCondos(queryParams),
    enabled: options?.enabled ?? true,
    staleTime: LIST_VIEW_MS,
    placeholderData: keepPreviousData,
  });
}

export function usePlatformCondoHealth(
  api: ApiClient,
  condoId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: condoId ? queryKeys.platformCondoHealth(condoId) : ['platform', 'condos', null],
    queryFn: () =>
      condoId ? api.platformCondoHealth(condoId) : Promise.reject(new Error('no condo')),
    enabled: (options?.enabled ?? true) && Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreatePlatformCondo(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<ApiClient['createPlatformCondo']>[0]) =>
      api.createPlatformCondo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'condos'] });
    },
  });
}

export function usePlatformCondoSummary(
  api: ApiClient,
  condoId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: condoId ? queryKeys.platformCondoSummary(condoId) : ['platform', 'condos', null],
    queryFn: () =>
      condoId ? api.platformCondoSummary(condoId) : Promise.reject(new Error('no condo')),
    enabled: (options?.enabled ?? true) && Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function usePlatformCondoHealth(
  api: ApiClient,
  condoId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: condoId ? queryKeys.platformCondoHealth(condoId) : ['platform', 'condos', null],
    queryFn: () =>
      condoId ? api.platformCondoHealth(condoId) : Promise.reject(new Error('no condo')),
    enabled: (options?.enabled ?? true) && Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreatePlatformCondo(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<ApiClient['createPlatformCondo']>[0]) =>
      api.createPlatformCondo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'condos'] });
    },
  });
}

export function useMyUnits(api: ApiClient) {
  return useQuery({
    queryKey: queryKeys.myUnits,
    queryFn: () => api.myUnits(),
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
  opts: { limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: unitId
      ? [...queryKeys.unitVisitors(unitId, view), opts.limit ?? 'all', opts.offset ?? 0]
      : ['visitors', 'unit', null],
    queryFn: () =>
      unitId
        ? api.visitorsForUnit(unitId, { ...(view ? { view } : {}), ...opts })
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

export function useCreateDeliveryPass(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDeliveryPassInput) => api.createDeliveryPass(input),
    onSuccess: (_data, vars) => {
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

export function useAdmitWalkInUnit(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Omit<import('@smartresidence/shared-types').CreateWalkInUnitInput, 'admitNow'>,
    ) => api.admitWalkInUnit(input),
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

export function useUnitInvoices(
  api: ApiClient,
  unitId: string | null,
  opts: { limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: unitId
      ? [...queryKeys.unitInvoices(unitId), opts.limit ?? 'all', opts.offset ?? 0]
      : ['invoices', 'unit', null],
    queryFn: () =>
      unitId ? api.invoicesForUnit(unitId, opts) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
    staleTime: LIST_VIEW_MS,
  });
}

export function usePayInvoice(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; provider: string; returnUrl?: string }) =>
      api.payInvoice(vars.id, { provider: vars.provider, returnUrl: vars.returnUrl }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.invoice(vars.id) });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function usePollDuitNowInvoiceStatus(
  api: ApiClient,
  paymentId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['duitnow-status', 'invoice', paymentId],
    queryFn: () => (paymentId ? api.pollDuitNowInvoiceStatus(paymentId) : Promise.reject()),
    enabled: Boolean(paymentId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data as { settled?: boolean; pending?: boolean } | undefined;
      return enabled && data && !data.settled ? 3000 : false;
    },
  });
}

export function usePollDuitNowAdvanceStatus(
  api: ApiClient,
  advancePaymentId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['duitnow-status', 'advance', advancePaymentId],
    queryFn: () =>
      advancePaymentId ? api.pollDuitNowAdvanceStatus(advancePaymentId) : Promise.reject(),
    enabled: Boolean(advancePaymentId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data as { settled?: boolean; pending?: boolean } | undefined;
      return enabled && data && !data.settled ? 3000 : false;
    },
  });
}

export function useCreateAdvancePayment(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').CreateAdvancePaymentInput) =>
      api.createAdvancePayment(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitStatement(vars.unitId) });
      qc.invalidateQueries({ queryKey: ['accounting', 'statement'] });
      qc.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}

export function useCondoInvoices(api: ApiClient, condoId: string | null, status?: string) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoInvoices(condoId, status) : ['invoices', 'condo', null],
    queryFn: () =>
      condoId
        ? api.invoicesForCondo(condoId, status ? { status } : {})
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useRecordManualPayment(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      input: import('@smartresidence/shared-types').RecordManualPaymentInput;
    }) => api.recordManualPayment(vars.id, vars.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useVoidInvoice(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) => api.voidInvoice(vars.id, vars.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useGenerateRecurringInvoices(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').GenerateRecurringInput;
    }) => api.generateRecurringInvoices(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: queryKeys.automationStatus(vars.condoId) });
    },
  });
}

export function useRunInvoiceDueSweep(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string }) => api.runInvoiceDueSweep(vars.condoId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: queryKeys.automationStatus(vars.condoId) });
    },
  });
}

// -- Deposits & receipts ---------------------------------------------

export function useCondoDeposits(
  api: ApiClient,
  condoId: string | null,
  params?: { status?: string; unitId?: string },
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.condoDeposits(condoId, params?.status, params?.unitId)
      : ['deposits', 'condo', null],
    queryFn: () =>
      condoId
        ? api.depositsForCondo(condoId, params ?? {})
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useUnitDeposits(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitDeposits(unitId) : ['deposits', 'unit', null],
    queryFn: () =>
      unitId ? api.depositsForUnit(unitId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
  });
}

export function useRecordDeposit(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').RecordDepositInput) =>
      api.recordDeposit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposits'] });
      qc.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}

export function useRefundDeposit(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      input: import('@smartresidence/shared-types').RefundDepositInput;
    }) => api.refundDeposit(vars.id, vars.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposits'] });
      qc.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}

export function useCondoReceipts(api: ApiClient, condoId: string | null, kind?: string) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoReceipts(condoId, kind) : ['receipts', 'condo', null],
    queryFn: () =>
      condoId
        ? api.receiptsForCondo(condoId, kind ? { kind } : {})
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useUnitReceipts(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitReceipts(unitId) : ['receipts', 'unit', null],
    queryFn: () =>
      unitId ? api.receiptsForUnit(unitId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
  });
}

// -- Billing settings (fee schedule + receipt template) --------------

export function useFeeRates(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.feeRates(condoId) : ['fee-rates', null],
    queryFn: () => (condoId ? api.feeRates(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useUpsertFeeRate(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').UpsertFeeRateInput;
    }) => api.upsertFeeRate(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.feeRates(vars.condoId) });
    },
  });
}

export function useDeleteFeeRate(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; unitTypeId: string }) =>
      api.deleteFeeRate(vars.condoId, vars.unitTypeId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.feeRates(vars.condoId) });
    },
  });
}

export function useFeeExtraLines(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.feeExtraLines(condoId) : ['fee-extra-lines', null],
    queryFn: () => (condoId ? api.feeExtraLines(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useUpsertFeeExtraLine(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').UpsertFeeScheduleExtraLineInput;
    }) => api.upsertFeeExtraLine(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.feeExtraLines(vars.condoId) });
    },
  });
}

export function useAddFeeExtraLinePresets(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').AddFeeSchedulePresetsInput;
    }) => api.addFeeExtraLinePresets(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.feeExtraLines(vars.condoId) });
    },
  });
}

export function useDeleteFeeExtraLine(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; id: string }) =>
      api.deleteFeeExtraLine(vars.condoId, vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.feeExtraLines(vars.condoId) });
    },
  });
}

export function useReceiptTemplate(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.receiptTemplate(condoId) : ['receipt-template', null],
    queryFn: () => (condoId ? api.receiptTemplate(condoId) : Promise.resolve(null)),
    enabled: Boolean(condoId),
  });
}

export function useUpdateReceiptTemplate(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: Partial<import('@smartresidence/shared-types').ReceiptTemplateConfig>;
    }) => api.updateReceiptTemplate(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.receiptTemplate(vars.condoId) });
    },
  });
}

export function useBillingAutomation(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.billingAutomation(condoId) : ['billing-automation', null],
    queryFn: () => (condoId ? api.billingAutomation(condoId) : Promise.resolve(null)),
    enabled: Boolean(condoId),
  });
}

export function useBillingAutomationPreview(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.billingAutomationPreview(condoId)
      : ['billing-automation-preview', null],
    queryFn: () => (condoId ? api.previewBillingAutomation(condoId) : Promise.resolve(null)),
    enabled: Boolean(condoId),
  });
}

export function useUpdateBillingAutomation(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: Partial<import('@smartresidence/shared-types').BillingAutomationSettings>;
    }) => api.updateBillingAutomation(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.billingAutomation(vars.condoId) });
      qc.invalidateQueries({ queryKey: queryKeys.billingAutomationPreview(vars.condoId) });
    },
  });
}

export function useRunBillingAutomation(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; dryRun?: boolean }) =>
      api.runBillingAutomation(vars.condoId, { dryRun: vars.dryRun }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: queryKeys.billingAutomation(vars.condoId) });
      qc.invalidateQueries({ queryKey: queryKeys.billingAutomationPreview(vars.condoId) });
      qc.invalidateQueries({ queryKey: queryKeys.automationStatus(vars.condoId) });
    },
  });
}

export function useAutomationStatus(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.automationStatus(condoId) : ['automations', 'status', null],
    queryFn: () =>
      condoId ? api.automationStatus(condoId) : Promise.reject(new Error('no condo')),
    enabled: Boolean(condoId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// -- First-time setup / onboarding (F4) ------------------------------

export function useSetupStatus(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.setupStatus(condoId) : ['setup', 'status', null],
    queryFn: () => (condoId ? api.getSetupStatus(condoId) : Promise.resolve(null)),
    enabled: Boolean(condoId),
  });
}

export function useUpdateSetupStep(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').UpdateSetupStepInput;
    }) => api.updateSetupStep(vars.condoId, vars.input),
    onSuccess: (data, vars) => {
      qc.setQueryData(queryKeys.setupStatus(vars.condoId), data);
    },
  });
}

export function useCompleteSetup(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string }) => api.completeSetup(vars.condoId),
    onSuccess: (data, vars) => {
      qc.setQueryData(queryKeys.setupStatus(vars.condoId), data);
    },
  });
}

export function useDismissSetup(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string }) => api.dismissSetup(vars.condoId),
    onSuccess: (data, vars) => {
      qc.setQueryData(queryKeys.setupStatus(vars.condoId), data);
    },
  });
}

// -- Payment gateways ------------------------------------------------

export function useGateways(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.gateways(condoId) : ['gateways', null],
    queryFn: () => (condoId ? api.listGateways(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useUpsertGateway(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').UpsertGatewayInput;
    }) => api.upsertGateway(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.gateways(vars.condoId) });
      qc.invalidateQueries({ queryKey: queryKeys.payableMethods(vars.condoId) });
    },
  });
}

export function useSetGatewayEnabled(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; id: string; enabled: boolean }) =>
      api.setGatewayEnabled(vars.condoId, vars.id, vars.enabled),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.gateways(vars.condoId) });
      qc.invalidateQueries({ queryKey: queryKeys.payableMethods(vars.condoId) });
    },
  });
}

export function useDeleteGateway(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; id: string }) => api.deleteGateway(vars.condoId, vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.gateways(vars.condoId) });
      qc.invalidateQueries({ queryKey: queryKeys.payableMethods(vars.condoId) });
    },
  });
}

// -- E-invoice (LHDN MyInvois) --------------------------------------

export function useEInvoiceConfig(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.eInvoiceConfig(condoId) : ['einvoice', 'config', null],
    queryFn: () => (condoId ? api.eInvoiceConfig(condoId) : Promise.resolve(null)),
    enabled: Boolean(condoId),
  });
}

export function useUpdateEInvoiceConfig(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').UpdateEInvoiceConfigInput;
    }) => api.updateEInvoiceConfig(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.eInvoiceConfig(vars.condoId) });
    },
  });
}

export function useEInvoice(api: ApiClient, invoiceId: string | null) {
  return useQuery({
    queryKey: invoiceId ? queryKeys.eInvoice(invoiceId) : ['einvoice', 'invoice', null],
    queryFn: () => (invoiceId ? api.eInvoiceForInvoice(invoiceId) : Promise.resolve(null)),
    enabled: Boolean(invoiceId),
  });
}

export function useSubmitEInvoice(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { invoiceId: string }) => api.submitEInvoice(vars.invoiceId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.eInvoice(vars.invoiceId) });
    },
  });
}

export function useCancelEInvoice(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      invoiceId: string;
      input?: import('@smartresidence/shared-types').CancelEInvoiceInput;
    }) => api.cancelEInvoice(vars.invoiceId, vars.input ?? {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.eInvoice(vars.invoiceId) });
    },
  });
}

// -- WhatsApp notifications -----------------------------------------

export function useWhatsAppConfig(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.whatsAppConfig(condoId) : ['notifications', 'whatsapp', null],
    queryFn: () => (condoId ? api.whatsAppConfig(condoId) : Promise.resolve(null)),
    enabled: Boolean(condoId),
  });
}

export function useUpdateWhatsAppConfig(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').UpdateWhatsAppConfigInput;
    }) => api.updateWhatsAppConfig(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.whatsAppConfig(vars.condoId) });
    },
  });
}

export function useTestWhatsAppSend(api: ApiClient) {
  return useMutation({
    mutationFn: (vars: { condoId: string; phone: string }) =>
      api.testWhatsAppSend(vars.condoId, vars.phone),
  });
}

// -- MCP integrations -----------------------------------------------

export function useMcpServers(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.mcpServers(condoId) : ['integrations', 'mcp', null],
    queryFn: () => (condoId ? api.listMcpServers(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useUpsertMcpServer(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      input: import('@smartresidence/shared-types').UpsertMcpServerInput;
    }) => api.upsertMcpServer(vars.condoId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers(vars.condoId) });
    },
  });
}

export function useTestMcpServer(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; id: string }) => api.testMcpServer(vars.condoId, vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers(vars.condoId) });
    },
  });
}

export function useSetMcpServerEnabled(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; id: string; enabled: boolean }) =>
      api.setMcpServerEnabled(vars.condoId, vars.id, vars.enabled),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers(vars.condoId) });
    },
  });
}

export function useDeleteMcpServer(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; id: string }) =>
      api.deleteMcpServer(vars.condoId, vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers(vars.condoId) });
    },
  });
}

export function usePayableMethods(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.payableMethods(condoId) : ['payment-methods', null],
    queryFn: () => (condoId ? api.payableMethods(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

// -- Accounting reports & prepayments --------------------------------

export function useFundBalances(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.fundBalances(condoId) : ['accounting', 'fund-balances', null],
    queryFn: () => (condoId ? api.fundBalances(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
    staleTime: REPORT_VIEW_MS,
  });
}

export function useCollectionsSummary(
  api: ApiClient,
  condoId: string | null,
  params?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.collections(condoId, params?.from, params?.to)
      : ['accounting', 'collections', null],
    queryFn: () =>
      condoId ? api.collectionsSummary(condoId, params ?? {}) : Promise.resolve(null),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useArrearsAging(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.arrears(condoId) : ['accounting', 'arrears', null],
    queryFn: () => (condoId ? api.arrearsAging(condoId) : Promise.resolve(null)),
    enabled: Boolean(condoId),
    staleTime: REPORT_VIEW_MS,
  });
}

export function useFundSummary(
  api: ApiClient,
  condoId: string | null,
  params?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.fundSummary(condoId, params?.from, params?.to)
      : ['accounting', 'fund-summary', null],
    queryFn: () => (condoId ? api.fundSummary(condoId, params ?? {}) : Promise.resolve(null)),
    enabled: Boolean(condoId),
    staleTime: REPORT_VIEW_MS,
  });
}

export function useCobTemplates(
  api: ApiClient,
  condoId: string | null,
  params?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.cobTemplates(condoId, params?.from, params?.to)
      : ['cob', 'templates', null],
    queryFn: () => (condoId ? api.listCobTemplates(condoId, params ?? {}) : Promise.resolve(null)),
    enabled: Boolean(condoId),
    staleTime: REPORT_VIEW_MS,
  });
}

export function useIncomeExpense(
  api: ApiClient,
  condoId: string | null,
  params?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.incomeExpense(condoId, params?.from, params?.to)
      : ['accounting', 'income-expense', null],
    queryFn: () => (condoId ? api.incomeExpense(condoId, params ?? {}) : Promise.resolve(null)),
    enabled: Boolean(condoId),
    staleTime: REPORT_VIEW_MS,
  });
}

export function usePaymentIssues(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.paymentIssues(condoId) : ['accounting', 'payment-issues', null],
    queryFn: () => (condoId ? api.paymentIssues(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useDismissPayment(api: ApiClient, condoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api.dismissPayment(paymentId),
    onSuccess: () => {
      if (condoId) {
        qc.invalidateQueries({ queryKey: queryKeys.paymentIssues(condoId) });
        qc.invalidateQueries({ queryKey: ['invoices'] });
      }
    },
  });
}

export function useApproveReviewedPayment(api: ApiClient, condoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api.approveReviewedPayment(paymentId),
    onSuccess: () => {
      if (condoId) {
        qc.invalidateQueries({ queryKey: queryKeys.paymentIssues(condoId) });
        qc.invalidateQueries({ queryKey: queryKeys.fundBalances(condoId) });
        qc.invalidateQueries({ queryKey: ['accounting', 'collections'] });
        qc.invalidateQueries({ queryKey: ['invoices'] });
      }
    },
  });
}

export function useUnitStatement(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitStatement(unitId) : ['accounting', 'statement', null],
    queryFn: () => (unitId ? api.unitStatement(unitId) : Promise.resolve(null)),
    enabled: Boolean(unitId),
    staleTime: REPORT_VIEW_MS,
  });
}

export function useChartOfAccounts(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.chartOfAccounts(condoId) : ['gl', 'coa', null],
    queryFn: () => (condoId ? api.chartOfAccounts(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
    staleTime: REPORT_VIEW_MS,
  });
}

export function useGlJournals(
  api: ApiClient,
  condoId: string | null,
  params?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.glJournals(condoId, params?.from, params?.to)
      : ['gl', 'journals', null],
    queryFn: () => (condoId ? api.glJournals(condoId, params ?? {}) : Promise.resolve([])),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useGlJournalDetail(api: ApiClient, condoId: string | null, entryId: string | null) {
  return useQuery({
    queryKey: condoId && entryId ? queryKeys.glJournal(condoId, entryId) : ['gl', 'journal', null],
    queryFn: () =>
      condoId && entryId ? api.glJournalDetail(condoId, entryId) : Promise.resolve(null),
    enabled: Boolean(condoId && entryId),
  });
}

export function useGlBankAccounts(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.glBankAccounts(condoId) : ['gl', 'bank-accounts', null],
    queryFn: () => (condoId ? api.glBankAccounts(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useBankStatementImports(
  api: ApiClient,
  condoId: string | null,
  accountId?: string,
) {
  return useQuery({
    queryKey: condoId ? queryKeys.bankImports(condoId, accountId) : ['gl', 'bank-imports', null],
    queryFn: () => (condoId ? api.bankStatementImports(condoId, accountId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useBankReconciliationWorksheet(
  api: ApiClient,
  condoId: string | null,
  importId: string | null,
) {
  return useQuery({
    queryKey:
      condoId && importId
        ? queryKeys.bankWorksheet(condoId, importId)
        : ['gl', 'bank-worksheet', null],
    queryFn: () =>
      condoId && importId
        ? api.bankReconciliationWorksheet(condoId, importId)
        : Promise.resolve(null),
    enabled: Boolean(condoId && importId),
  });
}

export function useImportBankStatement(api: ApiClient, condoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').ImportBankStatementInput) =>
      condoId ? api.importBankStatement(condoId, input) : Promise.reject(new Error('No condo')),
    onSuccess: () => {
      if (condoId) qc.invalidateQueries({ queryKey: ['gl', 'bank-imports', condoId] });
    },
  });
}

export function useMatchBankLine(api: ApiClient, condoId: string | null, importId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lineId: string; journalLineId: string | null }) =>
      condoId
        ? api.matchBankStatementLine(condoId, vars.lineId, vars.journalLineId)
        : Promise.reject(new Error('No condo')),
    onSuccess: () => {
      if (condoId && importId) {
        qc.invalidateQueries({ queryKey: queryKeys.bankWorksheet(condoId, importId) });
      }
    },
  });
}

export function useRecordPrepayment(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').RecordPrepaymentInput) =>
      api.recordPrepayment(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['receipts'] });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
  });
}

export function useUnitDefects(
  api: ApiClient,
  unitId: string | null,
  opts: { limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: unitId
      ? [...queryKeys.unitDefects(unitId), opts.limit ?? 'all', opts.offset ?? 0]
      : ['defects', 'unit', null],
    queryFn: () =>
      unitId ? api.defectsForUnit(unitId, opts) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
    staleTime: LIST_VIEW_MS,
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

export function useDefect(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.defect(id) : ['defects', null],
    queryFn: () => (id ? api.defect(id) : Promise.reject(new Error('no defect'))),
    enabled: Boolean(id),
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

export function useAddDefectUpdate(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      message: string;
      isInternal?: boolean;
      attachmentIds?: string[];
    }) =>
      api.addDefectUpdate(vars.id, {
        message: vars.message,
        isInternal: vars.isInternal,
        attachmentIds: vars.attachmentIds,
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
  opts: {
    manage?: boolean;
    category?: import('@smartresidence/shared-types').AnnouncementCategory;
    includeStats?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) {
  return useQuery({
    queryKey: condoId
      ? [
          ...queryKeys.condoAnnouncements(condoId),
          opts.manage ? 'manage' : 'resident',
          opts.category ?? 'all',
          opts.includeStats ? 'stats' : 'no-stats',
          opts.limit ?? 'all',
          opts.offset ?? 0,
        ]
      : ['announcements', 'condo', null],
    queryFn: () =>
      condoId
        ? api.announcementsForCondo(condoId, {
            manage: opts.manage,
            category: opts.category,
            includeStats: opts.includeStats,
            limit: opts.limit,
            offset: opts.offset,
          })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useAnnouncementReadStats(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? ['announcements', id, 'stats'] : ['announcements', null, 'stats'],
    queryFn: () => (id ? api.announcementReadStats(id) : Promise.reject(new Error('No id'))),
    enabled: Boolean(id),
  });
}

export function useAnnouncement(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? ['announcements', id] : ['announcements', null],
    queryFn: () => (id ? api.announcement(id) : Promise.reject(new Error('No id'))),
    enabled: Boolean(id),
  });
}

export function useCreateAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => api.createAnnouncement(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.setQueryData(['announcements', data.id], data);
    },
  });
}

export function useUpdateAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateAnnouncementInput }) =>
      api.updateAnnouncement(vars.id, vars.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      if (data?.id) qc.setQueryData(['announcements', data.id], data);
    },
  });
}

export function useDeleteAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAnnouncement(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.removeQueries({ queryKey: ['announcements', id] });
    },
  });
}

export function useMarkAnnouncementRead(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markAnnouncementRead(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements', id, 'stats'] });
    },
  });
}

export function useAckAnnouncement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.ackAnnouncement(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements', id, 'stats'] });
    },
  });
}

export function useCondoPolls(
  api: ApiClient,
  condoId: string | null,
  opts: { manage?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId
      ? [...queryKeys.condoPolls(condoId), opts.manage ? 'manage' : 'resident']
      : ['polls', 'condo', null],
    queryFn: () =>
      condoId
        ? api.pollsForCondo(condoId, { manage: opts.manage })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
  });
}

export function usePoll(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.poll(id) : ['polls', null],
    queryFn: () => (id ? api.poll(id) : Promise.reject(new Error('No id'))),
    enabled: Boolean(id),
  });
}

export function useCreatePoll(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePollInput) => api.createPoll(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['polls'] });
      if (data.id) qc.setQueryData(queryKeys.poll(data.id), data);
    },
  });
}

export function useUpdatePoll(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdatePollInput }) => api.updatePoll(vars.id, vars.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['polls'] });
      if (data?.id) qc.setQueryData(queryKeys.poll(data.id), data);
    },
  });
}

export function useCastPollVote(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { pollId: string; data: CastPollVoteInput }) =>
      api.castPollVote(vars.pollId, vars.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['polls'] });
      qc.invalidateQueries({ queryKey: queryKeys.poll(vars.pollId) });
    },
  });
}

export function useCondoMeetings(
  api: ApiClient,
  condoId: string | null,
  opts: { manage?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId
      ? [...queryKeys.condoMeetings(condoId), opts.manage ? 'manage' : 'resident']
      : ['governance', 'condo', null],
    queryFn: () =>
      condoId
        ? api.meetingsForCondo(condoId, { manage: opts.manage })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
  });
}

export function useMeeting(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.meeting(id) : ['governance', null],
    queryFn: () => (id ? api.meeting(id) : Promise.reject(new Error('No id'))),
    enabled: Boolean(id),
  });
}

export function useCreateMeeting(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGeneralMeetingInput) => api.createMeeting(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['governance'] });
      if (data.id) qc.setQueryData(queryKeys.meeting(data.id), data);
    },
  });
}

export function useUpdateMeeting(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateGeneralMeetingInput }) =>
      api.updateMeeting(vars.id, vars.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['governance'] });
      if (data?.id) qc.setQueryData(queryKeys.meeting(data.id), data);
    },
  });
}

export function usePublishMeetingMinutes(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data?: PublishMeetingMinutesInput }) =>
      api.publishMeetingMinutes(vars.id, vars.data ?? {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['governance'] });
      if (data?.id) qc.setQueryData(queryKeys.meeting(data.id), data);
    },
  });
}

export function usePublishMeetingNotice(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.publishMeetingNotice(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['governance'] });
      if (data?.id) qc.setQueryData(queryKeys.meeting(data.id), data);
    },
  });
}

export function useAddMeetingResolution(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { meetingId: string; data: CreateMeetingResolutionInput }) =>
      api.addMeetingResolution(vars.meetingId, vars.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['governance'] });
      qc.invalidateQueries({ queryKey: queryKeys.meeting(vars.meetingId) });
    },
  });
}

export function useOpenResolutionVoting(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { resolutionId: string; data?: OpenResolutionVotingInput }) =>
      api.openResolutionVoting(vars.resolutionId, vars.data ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['governance'] });
    },
  });
}

export function useCloseResolutionVoting(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resolutionId: string) => api.closeResolutionVoting(resolutionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['governance'] });
    },
  });
}

export function useCastResolutionVote(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { resolutionId: string; data: CastResolutionVoteInput }) =>
      api.castResolutionVote(vars.resolutionId, vars.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['governance'] });
    },
  });
}

export function useSubmitMeetingProxy(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { meetingId: string; data: SubmitMeetingProxyInput }) =>
      api.submitMeetingProxy(vars.meetingId, vars.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.meeting(vars.meetingId) });
    },
  });
}

// Facility / amenity booking (§4.6) ----------------------------------

export function useFacilities(
  api: ApiClient,
  condoId: string | null,
  opts: { includeInactive?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.condoFacilities(condoId, opts.includeInactive)
      : ['facilities', 'condo', null],
    queryFn: async () => {
      if (!condoId) return [];
      const page = await api.facilitiesForCondo(condoId, {
        includeInactive: opts.includeInactive,
        limit: 100,
        offset: 0,
      });
      return page.items;
    },
    enabled: Boolean(condoId),
  });
}

export function useFacilityAvailability(
  api: ApiClient,
  facilityId: string | null,
  date: string | null,
) {
  return useQuery({
    queryKey:
      facilityId && date
        ? queryKeys.facilityAvailability(facilityId, date)
        : ['facilities', 'availability', null],
    queryFn: () =>
      facilityId && date
        ? api.facilityAvailability(facilityId, date)
        : Promise.reject(new Error('No facility/date')),
    enabled: Boolean(facilityId && date),
  });
}

export function useCreateFacility(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFacilityInput) => api.createFacility(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facilities'] }),
  });
}

export function useUpdateFacility(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateFacilityInput }) =>
      api.updateFacility(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facilities'] }),
  });
}

export function useDeleteFacility(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFacility(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facilities'] }),
  });
}

export function useMyBookings(api: ApiClient, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.myBookings,
    queryFn: () => api.myBookings(),
    enabled: opts.enabled ?? true,
    staleTime: LIST_VIEW_MS,
  });
}

export function useCondoBookings(
  api: ApiClient,
  condoId: string | null,
  params: { status?: string; facilityId?: string; upcoming?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoBookings(condoId, params) : ['bookings', 'condo', null],
    queryFn: () =>
      condoId ? api.condoBookings(condoId, params) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreateBooking(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => api.createBooking(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
}

export function useCancelBooking(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) => api.cancelBooking(vars.id, vars.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
}

export function useApproveBooking(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveBooking(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}

export function useRejectBooking(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) => api.rejectBooking(vars.id, vars.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}

// Condo forms & workflows --------------------------------------------

export function useFormTemplates(
  api: ApiClient,
  condoId: string | null,
  opts: { includeInactive?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.condoFormTemplates(condoId, opts.includeInactive)
      : ['forms', 'templates', null],
    queryFn: async () => {
      if (!condoId) return [];
      const page = await api.formTemplatesForCondo(condoId, {
        includeInactive: opts.includeInactive,
        limit: 100,
        offset: 0,
      });
      return page.items;
    },
    enabled: Boolean(condoId),
  });
}

export function useMyFormSubmissions(api: ApiClient) {
  return useQuery({
    queryKey: queryKeys.myFormSubmissions,
    queryFn: () => api.myFormSubmissions(),
  });
}

export function useCondoFormSubmissions(
  api: ApiClient,
  condoId: string | null,
  params: { status?: string; templateId?: string } = {},
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.condoFormSubmissions(condoId, params)
      : ['forms', 'submissions', null],
    queryFn: () =>
      condoId
        ? api.condoFormSubmissions(condoId, params)
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
  });
}

export function useCreateFormSubmission(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').CreateFormSubmissionInput) =>
      api.createFormSubmission(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useUpdateFormSubmission(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      data: import('@smartresidence/shared-types').UpdateFormSubmissionInput;
    }) => api.updateFormSubmission(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useCancelFormSubmission(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelFormSubmission(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useApproveFormSubmission(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveFormSubmission(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useRejectFormSubmission(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reviewNote?: string }) =>
      api.rejectFormSubmission(vars.id, { reviewNote: vars.reviewNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

// Documents vault ----------------------------------------------------

export function useDocumentFolders(
  api: ApiClient,
  condoId: string | null,
  opts: { includeInactive?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.documentFolders(condoId, opts.includeInactive)
      : ['documents', 'folders', null],
    queryFn: () =>
      condoId
        ? api.documentFoldersForCondo(condoId, { includeInactive: opts.includeInactive })
        : Promise.resolve([]),
    enabled: Boolean(condoId),
  });
}

export function useCondoDocuments(
  api: ApiClient,
  condoId: string | null,
  params: { folderId?: string; includeInactive?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoDocuments(condoId, params) : ['documents', 'condo', null],
    queryFn: async () => {
      if (!condoId) return [];
      const page = await api.condoDocuments(condoId, { ...params, limit: 100, offset: 0 });
      return page.items;
    },
    enabled: Boolean(condoId),
  });
}

export function useDocumentVersions(api: ApiClient, documentId: string | null) {
  return useQuery({
    queryKey: documentId ? queryKeys.documentVersions(documentId) : ['documents', null, 'versions'],
    queryFn: () => (documentId ? api.documentVersions(documentId) : Promise.resolve([])),
    enabled: Boolean(documentId),
  });
}

export function useCreateDocumentFolder(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').CreateDocumentFolderInput) =>
      api.createDocumentFolder(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUpdateDocumentFolder(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      data: import('@smartresidence/shared-types').UpdateDocumentFolderInput;
    }) => api.updateDocumentFolder(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useCreateDocument(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').CreateDocumentInput) =>
      api.createDocument(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function usePublishDocumentVersion(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      documentId: string;
      input: import('@smartresidence/shared-types').PublishDocumentVersionInput;
    }) => api.publishDocumentVersion(vars.documentId, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useCreateFormTemplate(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').CreateFormTemplateInput) =>
      api.createFormTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useUpdateFormTemplate(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      data: import('@smartresidence/shared-types').UpdateFormTemplateInput;
    }) => api.updateFormTemplate(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useDeleteFormTemplate(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFormTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useCondoBlocks(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? ['blocks', condoId] : ['blocks', null],
    queryFn: () => api.listBlocks(condoId!),
    enabled: Boolean(condoId),
  });
}

export function useCondoUnitsSearch(
  api: ApiClient,
  condoId: string | null,
  search: string,
  enabled = true,
) {
  return useQuery({
    queryKey: condoId ? ['units', condoId, search] : ['units', null],
    queryFn: () =>
      api.listUnits(condoId!, { limit: 50, offset: 0, search: search.trim() || undefined }),
    enabled: Boolean(condoId) && enabled,
  });
}

export function useResidentContact(api: ApiClient, unitId: string | null, userId: string | null) {
  return useQuery({
    queryKey: unitId && userId ? ['resident-contact', unitId, userId] : ['resident-contact', null],
    queryFn: () =>
      unitId && userId ? api.residentContact(unitId, userId) : Promise.reject(new Error('no user')),
    enabled: Boolean(unitId && userId),
  });
}

export function useUpdateResidentContact(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      unitId: string;
      userId: string;
      input: { name?: string; email?: string; phone?: string };
    }) => api.updateResidentContact(vars.unitId, vars.userId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['resident-contact', vars.unitId, vars.userId] });
      qc.invalidateQueries({ queryKey: ['units'] });
      qc.invalidateQueries({ queryKey: ['admin', 'units'] });
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

export function useUpdateMlAssignment(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; enabled: boolean }) =>
      api.updateMlAssignment(vars.condoId, { enabled: vars.enabled }),
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

export function useVisitorBlacklist(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.visitorBlacklist(condoId) : ['visitors', 'blacklist', null],
    queryFn: () =>
      condoId ? api.visitorBlacklist(condoId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreateVisitorBlacklist(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      condoId: string;
      data: import('@smartresidence/shared-types').CreateVisitorBlacklistInput;
    }) => api.createVisitorBlacklist(vars.condoId, vars.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.visitorBlacklist(vars.condoId) });
    },
  });
}

export function useUpdateVisitorBlacklist(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      condoId: string;
      data: import('@smartresidence/shared-types').UpdateVisitorBlacklistInput;
    }) => api.updateVisitorBlacklist(vars.id, vars.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.visitorBlacklist(vars.condoId) });
    },
  });
}

export function useDeleteVisitorBlacklist(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; condoId: string }) => api.deleteVisitorBlacklist(vars.id),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.visitorBlacklist(vars.condoId) });
    },
  });
}

export function useUnitRecurringPasses(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId
      ? queryKeys.unitRecurringPasses(unitId)
      : ['visitors', 'recurring-passes', null],
    queryFn: () =>
      unitId ? api.recurringPassesForUnit(unitId) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(unitId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreateRecurringPass(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@smartresidence/shared-types').CreateRecurringPassInput) =>
      api.createRecurringPass(input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitRecurringPasses(vars.unitId) });
    },
  });
}

export function useUpdateRecurringPass(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      unitId: string;
      data: import('@smartresidence/shared-types').UpdateRecurringPassInput;
    }) => api.updateRecurringPass(vars.id, vars.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitRecurringPasses(vars.unitId) });
    },
  });
}

export function useDeleteRecurringPass(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; unitId: string }) => api.deleteRecurringPass(vars.id),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitRecurringPasses(vars.unitId) });
    },
  });
}

export function useNotifications(
  api: ApiClient,
  opts: { limit?: number; unreadOnly?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.notifications(opts.unreadOnly),
    queryFn: () => api.listNotifications({ limit: opts.limit ?? 20, unreadOnly: opts.unreadOnly }),
    enabled: opts.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useMarkNotificationsRead(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.markNotificationsRead(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
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

export function useSessions(api: ApiClient) {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => api.listSessions(),
    staleTime: LIST_VIEW_MS,
  });
}

export function useRevokeSession(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.revokeSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sessions }),
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

// -- Handover: unit types & defect taxonomy --------------------------

export function useUnitTypes(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.unitTypes(condoId) : ['unit-types', null],
    queryFn: () => (condoId ? api.unitTypes(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useDefectTaxonomy(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.defectTaxonomy(condoId) : ['defect-taxonomy', null],
    queryFn: () => (condoId ? api.defectTaxonomy(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
  });
}

export function useUnitHandoverTemplate(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitHandoverTemplate(unitId) : ['handover-template', null],
    queryFn: () =>
      unitId ? api.unitHandoverTemplate(unitId) : Promise.reject(new Error('no unit')),
    enabled: Boolean(unitId),
  });
}

export function useCreateUnitType(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUnitTypeInput) => api.createUnitType(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-types'] }),
  });
}

export function useUpdateUnitType(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateUnitTypeInput }) =>
      api.updateUnitType(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-types'] }),
  });
}

export function useDeleteUnitType(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteUnitType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-types'] }),
  });
}

export function useAddUnitTypeSpace(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { unitTypeId: string; data: CreateUnitTypeSpaceInput }) =>
      api.addUnitTypeSpace(vars.unitTypeId, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-types'] }),
  });
}

export function useUpdateUnitTypeSpace(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateUnitTypeSpaceInput }) =>
      api.updateUnitTypeSpace(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-types'] }),
  });
}

export function useDeleteUnitTypeSpace(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteUnitTypeSpace(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-types'] }),
  });
}

export function useCreateDefectSpaceType(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDefectSpaceTypeInput) => api.createDefectSpaceType(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useUpdateDefectSpaceType(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateDefectSpaceTypeInput }) =>
      api.updateDefectSpaceType(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useDeleteDefectSpaceType(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDefectSpaceType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useCreateDefectElement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDefectElementInput) => api.createDefectElement(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useUpdateDefectElement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateDefectElementInput }) =>
      api.updateDefectElement(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useDeleteDefectElement(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDefectElement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useCreateDefectIssue(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDefectIssueInput) => api.createDefectIssue(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useUpdateDefectIssue(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdateDefectIssueInput }) =>
      api.updateDefectIssue(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useDeleteDefectIssue(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDefectIssue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defect-taxonomy'] }),
  });
}

export function useSetUnitType(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { condoId: string; unitId: string; unitTypeId: string | null }) =>
      api.setUnitType(vars.condoId, vars.unitId, vars.unitTypeId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['units', vars.condoId] });
      qc.invalidateQueries({ queryKey: queryKeys.unitHandoverTemplate(vars.unitId) });
    },
  });
}

// -- Handover reports -------------------------------------------------

export function useCreateHandoverReport(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHandoverReportInput) => api.createHandoverReport(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['defect-reports'] });
      qc.invalidateQueries({ queryKey: queryKeys.unitDefects(vars.unitId) });
      qc.invalidateQueries({ queryKey: queryKeys.unitDefectReports(vars.unitId) });
    },
  });
}

export function useDefectReports(api: ApiClient, condoId: string | null) {
  return useQuery({
    queryKey: condoId ? queryKeys.defectReports(condoId) : ['defect-reports', 'condo', null],
    queryFn: () => (condoId ? api.defectReportsForCondo(condoId) : Promise.resolve([])),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useUnitDefectReports(api: ApiClient, unitId: string | null) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitDefectReports(unitId) : ['defect-reports', 'unit', null],
    queryFn: () => (unitId ? api.defectReportsForUnit(unitId) : Promise.resolve([])),
    enabled: Boolean(unitId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useDefectReport(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.defectReport(id) : ['defect-reports', null],
    queryFn: () => (id ? api.defectReport(id) : Promise.reject(new Error('no report'))),
    enabled: Boolean(id),
  });
}

export function useBulkUpdateReportItems(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: BulkUpdateReportItemsInput }) =>
      api.bulkUpdateReportItems(vars.id, vars.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.defectReport(vars.id) });
      qc.invalidateQueries({ queryKey: ['defect-reports'] });
      qc.invalidateQueries({ queryKey: ['defects'] });
    },
  });
}

// -- Guard safety: panic / SOS ---------------------------------------

/** Active + recent SOS alerts for a condo (management/guard dashboards). */
export function useCondoSosAlerts(
  api: ApiClient,
  condoId: string | null,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoSosAlerts(condoId) : ['sos', 'condo', null],
    queryFn: () =>
      condoId ? api.condoSosAlerts(condoId) : Promise.resolve({ active: [], recent: [] }),
    enabled: (opts.enabled ?? true) && Boolean(condoId),
    // SOS is time-critical: poll frequently; realtime `sos:update` also invalidates.
    staleTime: 5_000,
    refetchInterval: 15_000,
  });
}

/** The current user's own raised SOS alerts (resident status view). */
export function useMySosAlerts(api: ApiClient, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.mySosAlerts,
    queryFn: () => api.mySosAlerts({ limit: 20 }),
    enabled: opts.enabled ?? true,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useRaiseSos(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RaiseSosInput) => api.raiseSos(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sos'] });
    },
  });
}

export function useAcknowledgeSos(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acknowledgeSos(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos'] }),
  });
}

export function useResolveSos(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; resolutionNote?: string }) =>
      api.resolveSos(vars.id, { resolutionNote: vars.resolutionNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos'] }),
  });
}

export function useCancelSos(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelSos(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos'] }),
  });
}

// -- Guard safety: patrol checkpoints + scans ------------------------

export function usePatrolCheckpoints(
  api: ApiClient,
  condoId: string | null,
  opts: { includeInactive?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.patrolCheckpoints(condoId, opts.includeInactive)
      : ['patrol', 'checkpoints', null],
    queryFn: () =>
      condoId
        ? api.patrolCheckpoints(condoId, { includeInactive: opts.includeInactive })
        : Promise.resolve([]),
    enabled: (opts.enabled ?? true) && Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function usePatrolScans(
  api: ApiClient,
  condoId: string | null,
  params: { checkpointId?: string; guardUserId?: string; from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: condoId ? queryKeys.patrolScans(condoId, params) : ['patrol', 'scans', null],
    queryFn: () =>
      condoId ? api.patrolScans(condoId, params) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreatePatrolCheckpoint(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePatrolCheckpointInput) => api.createPatrolCheckpoint(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol'] }),
  });
}

export function useUpdatePatrolCheckpoint(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: UpdatePatrolCheckpointInput }) =>
      api.updatePatrolCheckpoint(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol'] }),
  });
}

export function useRegeneratePatrolCode(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.regeneratePatrolCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol'] }),
  });
}

export function useDeletePatrolCheckpoint(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePatrolCheckpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol'] }),
  });
}

export function useScanPatrolCheckpoint(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatrolScanInput) => api.scanPatrolCheckpoint(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol'] }),
  });
}

export function useCondoParcels(
  api: ApiClient,
  condoId: string | null,
  params: { status?: string; unitId?: string; pendingOnly?: boolean } = {},
) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoParcels(condoId, params) : ['parcels', 'condo', null],
    queryFn: () =>
      condoId
        ? api.parcelsForCondo(condoId, params)
        : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useUnitParcels(
  api: ApiClient,
  unitId: string | null,
  params: { status?: string; pendingOnly?: boolean } = {},
) {
  return useQuery({
    queryKey: unitId ? queryKeys.unitParcels(unitId, params) : ['parcels', 'unit', null],
    queryFn: () =>
      unitId
        ? api.parcelsForUnit(unitId, params)
        : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    enabled: Boolean(unitId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreateParcel(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateParcelInput) => api.createParcel(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parcels'] }),
  });
}

export function useCollectParcel(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; notes?: string }) =>
      api.collectParcel(vars.id, { notes: vars.notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parcels'] }),
  });
}

export function useCondoLostFoundPosts(
  api: ApiClient,
  condoId: string | null,
  params: {
    kind?: string;
    status?: string;
    openOnly?: boolean;
    manage?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoLostFound(condoId, params) : ['lost-found', 'condo', null],
    queryFn: () =>
      condoId
        ? api.lostFoundForCondo(condoId, params)
        : Promise.resolve({ items: [], total: 0, limit: 50, offset: 0 }),
    enabled: Boolean(condoId),
    staleTime: LIST_VIEW_MS,
  });
}

export function useMyLostFoundPosts(
  api: ApiClient,
  params: { kind?: string; status?: string; limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: queryKeys.myLostFound(params),
    queryFn: () => api.myLostFoundPosts(params),
    staleTime: LIST_VIEW_MS,
  });
}

export function useLostFoundPost(api: ApiClient, id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.lostFoundPost(id) : ['lost-found', null],
    queryFn: () => (id ? api.lostFoundPost(id) : Promise.reject(new Error('No id'))),
    enabled: Boolean(id),
    staleTime: LIST_VIEW_MS,
  });
}

export function useCreateLostFoundPost(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLostFoundPostInput) => api.createLostFoundPost(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lost-found'] }),
  });
}

export function useResolveLostFoundPost(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resolveLostFoundPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lost-found'] }),
  });
}

export function useRemoveLostFoundPost(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeLostFoundPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lost-found'] }),
  });
}

export function useModerateRemoveLostFoundPost(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.moderateRemoveLostFoundPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lost-found'] }),
  });
}

export function useCondoVendors(
  api: ApiClient,
  condoId: string | null,
  params?: { activeOnly?: boolean; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: condoId ? queryKeys.condoVendors(condoId, params) : ['procurement', 'vendors', null],
    queryFn: () =>
      condoId ? api.vendorsForCondo(condoId, params) : Promise.reject(new Error('No condo')),
    enabled: !!condoId,
  });
}

export function useCreateVendor(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorInput) => api.createVendor(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'vendors'] }),
  });
}

export function useCondoVendorBills(
  api: ApiClient,
  condoId: string | null,
  params?: { status?: string; fund?: string; vendorId?: string },
) {
  return useQuery({
    queryKey: condoId
      ? queryKeys.condoVendorBills(condoId, params)
      : ['procurement', 'bills', null],
    queryFn: () =>
      condoId ? api.vendorBillsForCondo(condoId, params) : Promise.reject(new Error('No condo')),
    enabled: !!condoId,
  });
}

export function useCreateVendorBill(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorBillInput) => api.createVendorBill(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'bills'] }),
  });
}

export function useApproveVendorBill(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveVendorBill(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'bills'] }),
  });
}

export function usePayVendorBill(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.payVendorBill(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'bills'] }),
  });
}

export function useVoidVendorBill(api: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidVendorBill(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'bills'] }),
  });
}
