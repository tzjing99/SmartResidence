/**
 * Lightweight typed fetcher for the SmartResidence API.
 *
 * The API exposes an OpenAPI spec at GET /api/docs-json. In CI we run
 * `pnpm --filter @smartresidence/api openapi:export` which writes the spec
 * to `packages/api-client/openapi/openapi.json`, and `pnpm generate`
 * compiles it into `src/generated/schema.ts` so endpoint paths are typed.
 *
 * For day-to-day use, the high-level helpers in this file are usually
 * enough — they accept and return the Zod-validated types from
 * `@smartresidence/shared-types`.
 */
import type {
  AddFeeSchedulePresetsInput,
  Announcement,
  AnnouncementCategory,
  AnnouncementReadStats,
  ArrearsAging,
  AutomationStatusResponse,
  BalanceSheetReport,
  BankReconciliationWorksheet,
  BankStatementImportSummary,
  BillingAutomationPreview,
  BillingAutomationRunResult,
  BillingAutomationSettings,
  Booking,
  BulkUpdateReportItemsInput,
  CancelEInvoiceInput,
  CastPollVoteInput,
  CastResolutionVoteInput,
  CobTemplateListResponse,
  CollectParcelInput,
  CollectionsSummary,
  CreateAdvancePaymentInput,
  CreateAnnouncementInput,
  CreateBookingInput,
  CreateDefectElementInput,
  CreateDefectInput,
  CreateDefectIssueInput,
  CreateDefectSpaceTypeInput,
  CreateDeliveryPassInput,
  CreateDocumentFolderInput,
  CreateDocumentInput,
  CreateFacilityInput,
  CreateFavouriteVisitorInput,
  CreateFormSubmissionInput,
  CreateFormTemplateInput,
  CreateGeneralMeetingInput,
  CreateHandoverReportInput,
  CreateLostFoundPostInput,
  CreateMeetingResolutionInput,
  CreateParcelInput,
  CreatePatrolCheckpointInput,
  CreatePollInput,
  CreateRecurringPassInput,
  CreateUnitTypeInput,
  CreateUnitTypeSpaceInput,
  CreateVendorBillInput,
  CreateVendorInput,
  CreateVisitorBlacklistInput,
  CreateVisitorInput,
  DefectReportDetail,
  DefectReportSummary,
  DefectSpaceTypeTree,
  Deposit,
  Document,
  DocumentDownloadUrl,
  DocumentFolder,
  DocumentVersion,
  EInvoiceConfigView,
  EInvoiceView,
  Facility,
  FacilityAvailability,
  FavouriteVisitor,
  FeeScheduleExtraLine,
  FormSubmission,
  FormTemplate,
  FundBalance,
  FundSummaryReport,
  GatewayConnectionView,
  GeneralMeeting,
  GlAccountNode,
  GlJournalEntryDetail,
  GlJournalListItem,
  HandoverTemplate,
  ImportBankStatementInput,
  IncomeExpenseReport,
  Invoice,
  LostFoundPost,
  McpConnectionTestResult,
  McpServerConnectionView,
  MeetingProxy,
  MeetingResolution,
  OpenResolutionVotingInput,
  Parcel,
  PatrolCheckpoint,
  PatrolCheckpointStatus,
  PatrolScan,
  PatrolScanInput,
  PayableMethod,
  PaymentIntentResponse,
  PaymentIssue,
  PlatformCondoDetail,
  PlatformCondoSummary,
  Poll,
  PollMyVote,
  PostManualJournalInput,
  ProfitLossReport,
  PublishDocumentVersionInput,
  RaiseSosInput,
  Receipt,
  ReceiptTemplateConfig,
  RecordDepositInput,
  RecordPrepaymentInput,
  RecurringPass,
  RecurringPassVerify,
  RefundDepositInput,
  RejectFormSubmissionInput,
  ResolveSosInput,
  SetupStatus,
  SosAlert,
  SosCondoResponse,
  SubmitMeetingProxyInput,
  UnitStatement,
  UnitType,
  UnitTypeFeeRate,
  UpdateAnnouncementInput,
  UpdateDefectElementInput,
  UpdateDefectIssueInput,
  UpdateDefectSpaceTypeInput,
  UpdateDocumentFolderInput,
  UpdateDocumentInput,
  UpdateEInvoiceConfigInput,
  UpdateFacilityInput,
  UpdateFavouriteVisitorInput,
  UpdateFormSubmissionInput,
  UpdateFormTemplateInput,
  UpdateGeneralMeetingInput,
  UpdatePatrolCheckpointInput,
  UpdatePollInput,
  UpdateRecurringPassInput,
  UpdateSetupStepInput,
  UpdateUnitTypeInput,
  UpdateUnitTypeSpaceInput,
  UpdateVendorBillInput,
  UpdateVendorInput,
  UpdateVisitorBlacklistInput,
  UploadResponse,
  UploadedAttachment,
  UpsertFeeRateInput,
  UpsertFeeScheduleExtraLineInput,
  UpsertGatewayInput,
  UpsertMcpServerInput,
  Vendor,
  VendorBill,
  Visitor,
  VisitorBlacklist,
  VisitorListView,
} from '@smartresidence/shared-types';

export interface ApiResponse<T> {
  data: T;
}

export interface DepositListItem extends Deposit {
  unit?: { id: string; identifier: string; block?: { name: string } | null } | null;
  user?: { id: string; name: string } | null;
  receipt?: { id: string; number: string } | null;
}

export interface ReceiptListItem extends Receipt {
  unit?: { id: string; identifier: string } | null;
  issuedTo?: { id: string; name: string } | null;
}

export interface FeeRateRow {
  unitTypeId: string;
  unitTypeName: string;
  unitCount: number;
  feeRate: UnitTypeFeeRate | null;
}

// -- Communication threads + FAQ types --------------------------------

export type ThreadCategory =
  | 'BILLING'
  | 'MAINTENANCE'
  | 'FACILITY'
  | 'SECURITY'
  | 'COMPLAINT'
  | 'SUGGESTION'
  | 'GOVERNANCE'
  | 'GENERAL';
export type ThreadPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ThreadStatus =
  | 'OPEN'
  | 'AWAITING_RESIDENT'
  | 'AWAITING_MANAGEMENT'
  | 'PENDING_RESIDENT_CONFIRMATION'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';
export type ThreadMessageKind = 'MESSAGE' | 'INTERNAL_NOTE' | 'SYSTEM';
export type SlaState = 'NONE' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export type SlaBand = 'recommended' | 'acceptable' | 'risky';

export interface SlaPolicyItem {
  priority: ThreadPriority;
  id: string | null;
  resolutionMins: number;
  firstResponseMins: number;
  band: SlaBand;
  thresholds: { recommendedMaxMins: number; acceptableMaxMins: number };
  recommendedResolutionMins: number;
}

export interface MlPriorityStats {
  enabled: boolean;
  closedThreadCount: number;
  minRequired: number;
  ready: boolean;
  active: boolean;
}

export interface MlAssignmentStats {
  enabled: boolean;
  closedThreadCount: number;
  minRequired: number;
  ready: boolean;
  active: boolean;
}

export interface SlaSettingsResponse {
  condoId: string;
  unitCount: number;
  resolutionConfirmationGraceDays: number;
  atRiskThresholdPercent: number;
  policies: SlaPolicyItem[];
  editable: boolean;
  autoAssignment?: {
    generalTriagePool: string[];
    categoryPools: Array<{ category: ThreadCategory; userIds: string[] }>;
    seniorStaffPool: string[];
    mlEnabled?: boolean;
  };
  managementStaff?: Array<{ id: string; name: string; email: string | null }>;
  mlPriority?: MlPriorityStats;
  mlAssignment?: MlAssignmentStats;
}

export interface UserPreferences {
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  /** True when the account has a verified phone suitable for WhatsApp opt-in. */
  whatsappEligible?: boolean;
}

export interface AuthSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: { device?: string } | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  limit: number;
  offset: number;
  unreadOnly?: boolean;
}

export interface FaqDeflectMatch {
  match: {
    articleId: string;
    question: string;
    answer: string;
    score: number;
    category: string | null;
  } | null;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  category: ThreadCategory;
  priority: ThreadPriority;
  status: ThreadStatus;
  slaState: SlaState;
  lastMessageAt: string;
  createdAt: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  resolutionProposedAt?: string | null;
  resolutionProposedByUserId?: string | null;
  resolutionProposedMessageId?: string | null;
  reopenCount?: number;
  createdBy?: { id: string; name: string; email: string | null };
  assignedTo?: { id: string; name: string } | null;
  unit?: { id: string; identifier: string } | null;
  _count?: { messages: number };
}

export interface ThreadMessageItem {
  id: string;
  threadId: string;
  kind: ThreadMessageKind;
  body: string;
  createdAt: string;
  author?: { id: string; name: string };
  attachments?: Array<{
    id: string;
    key: string;
    thumbnailKey?: string | null;
    mimeType: string;
    width?: number | null;
    height?: number | null;
    size?: number;
  }>;
}

export interface ThreadDetail extends ThreadSummary {
  messages: ThreadMessageItem[];
}

export interface FaqCategoryItem {
  id: string;
  condoId: string;
  name: string;
  position: number;
}

export interface FaqArticleItem {
  id: string;
  condoId: string;
  categoryId: string | null;
  category?: FaqCategoryItem | null;
  question: string;
  answer: string;
  tags: string[];
  published: boolean;
  pinned: boolean;
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
}

export interface ListThreadsParams {
  status?: ThreadStatus;
  priority?: ThreadPriority;
  category?: ThreadCategory;
  assignedToUserId?: string;
  slaState?: SlaState;
  limit?: number;
  offset?: number;
}

export interface CreateThreadBody {
  unitId?: string;
  subject: string;
  category: ThreadCategory;
  body: string;
  attachmentIds?: string[];
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Async getter for the access token (lets you read from secure storage). */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Session id for server-side revocation (`x-session-id` on sign-out). */
  getSessionId?: () => Promise<string | null> | string | null;
  /** Called when the API responds with 401 so the host can refresh / sign-out. */
  onUnauthorized?: () => Promise<void> | void;
  /** Currently selected condo (sent as `x-condo-id` for tenant scoping). */
  getActiveCondoId?: () => Promise<string | null> | string | null;
  fetch?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  constructor(private readonly cfg: ApiClientConfig) {}

  /** Current access token, if any (used to authenticate the realtime socket). */
  async getAccessToken(): Promise<string | null> {
    return (await this.cfg.getAccessToken?.()) ?? null;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = await this.cfg.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const sessionId = await this.cfg.getSessionId?.();
    if (sessionId) headers['x-session-id'] = sessionId;

    const condoId = await this.cfg.getActiveCondoId?.();
    if (condoId) headers['x-condo-id'] = condoId;

    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const res = await fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) await this.cfg.onUnauthorized?.();
    if (!res.ok) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* ignore */
      }
      const message =
        (parsed as { message?: string } | null)?.message ?? `HTTP ${res.status} ${res.statusText}`;
      throw new ApiError(res.status, parsed, message);
    }
    if (res.status === 204) return undefined as T;
    const json = (await res.json()) as ApiResponse<T> | T;
    return ((json as ApiResponse<T>).data ?? json) as T;
  }

  // Auth -------------------------------------------------------------
  signIn(input: { email: string; password: string; totp?: string }) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      sessionId: string;
    }>('POST', '/api/auth/sign-in', input);
  }
  signUp(input: { email: string; password: string; name: string; phone: string }) {
    return this.request<{ accessToken: string; refreshToken: string; sessionId: string }>(
      'POST',
      '/api/auth/sign-up',
      input,
    );
  }
  getProfile() {
    return this.request<{
      id: string;
      email: string | null;
      phone: string | null;
      name: string;
      locale: string;
    }>('GET', '/api/auth/profile');
  }
  updateProfile(input: { name?: string; email?: string; phone?: string }) {
    return this.request<{
      id: string;
      email: string | null;
      phone: string | null;
      name: string;
      locale: string;
    }>('PATCH', '/api/auth/profile', input);
  }
  refresh(refreshToken: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      sessionId: string;
    }>('POST', '/api/auth/refresh', { refreshToken });
  }
  signOut() {
    return this.request<void>('POST', '/api/auth/sign-out');
  }
  me() {
    return this.request<{ user: unknown; abilities: unknown[] }>('GET', '/api/auth/me');
  }

  // Tenancy ----------------------------------------------------------
  myCondos() {
    return this.request<
      Array<{ id: string; name: string; slug: string; brandColor: string | null }>
    >('GET', '/api/condos/mine');
  }
  myUnits() {
    return this.request<Array<unknown>>('GET', '/api/units/mine');
  }
  listUnits(condoId: string, params: { limit?: number; offset?: number; search?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.search) qs.set('search', params.search);
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/api/condos/${condoId}/units?${qs.toString()}`,
    );
  }
  residentContact(unitId: string, userId: string) {
    return this.request<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      locale: string;
      unit: { id: string; identifier: string; block?: { name: string } | null };
    }>('GET', `/api/units/${unitId}/residents/${userId}`);
  }
  updateResidentContact(
    unitId: string,
    userId: string,
    input: { name?: string; email?: string; phone?: string },
  ) {
    return this.request<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      locale: string;
      unit: { id: string; identifier: string; block?: { name: string } | null };
    }>('PATCH', `/api/units/${unitId}/residents/${userId}`, input);
  }
  listBlocks(condoId: string) {
    return this.request<Array<{ id: string; name: string; position: number }>>(
      'GET',
      `/api/condos/${condoId}/blocks`,
    );
  }

  // Visitors ---------------------------------------------------------
  createVisitor(input: CreateVisitorInput) {
    return this.request<Visitor>('POST', '/api/visitors', input);
  }
  createDeliveryPass(input: CreateDeliveryPassInput) {
    return this.request<Visitor>('POST', '/api/visitors/delivery-pass', input);
  }
  overnightPreview(condoId: string, expectedAt: Date) {
    const qs = new URLSearchParams({ expectedAt: expectedAt.toISOString() });
    return this.request<import('@smartresidence/shared-types').OvernightPreview>(
      'GET',
      `/api/visitors/overnight-preview/${condoId}?${qs.toString()}`,
    );
  }
  visitorsForUnit(
    unitId: string,
    params: { limit?: number; offset?: number; view?: VisitorListView } = {},
  ) {
    return this.request<{ items: Visitor[]; total: number }>(
      'GET',
      `/api/visitors/unit/${unitId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  visitorsForCondo(
    condoId: string,
    params: {
      status?: string;
      view?: VisitorListView;
      filter?: import('@smartresidence/shared-types').VisitorAdminFilter;
      search?: string;
      unitId?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    return this.request<{ items: Visitor[]; total: number; limit?: number; offset?: number }>(
      'GET',
      `/api/visitors/condo/${condoId}?${qs.toString()}`,
    );
  }
  visitorAdminStats(condoId: string) {
    return this.request<import('@smartresidence/shared-types').VisitorAdminStats>(
      'GET',
      `/api/visitors/admin/stats/${condoId}`,
    );
  }
  favouriteVisitorsForUnit(unitId: string) {
    return this.request<{ items: FavouriteVisitor[]; total: number }>(
      'GET',
      `/api/visitors/favourites/unit/${unitId}`,
    );
  }
  createFavouriteVisitor(input: CreateFavouriteVisitorInput) {
    return this.request<FavouriteVisitor>('POST', '/api/visitors/favourites', input);
  }
  updateFavouriteVisitor(id: string, input: UpdateFavouriteVisitorInput) {
    return this.request<FavouriteVisitor>('PATCH', `/api/visitors/favourites/${id}`, input);
  }
  deleteFavouriteVisitor(id: string) {
    return this.request<void>('DELETE', `/api/visitors/favourites/${id}`);
  }
  visitorQr(visitorId: string) {
    return this.request<{ qrPayload: string; accessCode: string | null; png: string }>(
      'GET',
      `/api/visitors/${visitorId}/qr`,
    );
  }
  approveVisitor(visitorId: string) {
    return this.request<Visitor>('POST', `/api/visitors/${visitorId}/approve`);
  }

  guardApproveWalkIn(
    visitorId: string,
    method: import('@smartresidence/shared-types').GuardApprovalMethod,
  ) {
    return this.request<Visitor>('POST', `/api/visitors/${visitorId}/guard-approve`, { method });
  }
  acknowledgeWalkIn(visitorId: string, input?: { gateLocation?: string; notes?: string }) {
    return this.request<{ id: string; visitorId: string; checkInAt: string }>(
      'POST',
      `/api/visitors/${visitorId}/acknowledge-walk-in`,
      input ?? {},
    );
  }
  approveOvernightVisitor(visitorId: string) {
    return this.request<Visitor>('POST', `/api/visitors/${visitorId}/approve-overnight`);
  }
  condoVisitorSettings(condoId: string) {
    return this.request<import('@smartresidence/shared-types').CondoVisitorSettings>(
      'GET',
      `/api/settings/condo/${condoId}/visitor`,
    );
  }
  updateCondoVisitorSettings(
    condoId: string,
    body: import('@smartresidence/shared-types').UpdateCondoVisitorSettingsInput,
  ) {
    return this.request<import('@smartresidence/shared-types').CondoVisitorSettings>(
      'PATCH',
      `/api/settings/condo/${condoId}/visitor`,
      body,
    );
  }
  overnightUnitSummary(condoId: string, month?: string) {
    const qs = month ? `?month=${encodeURIComponent(month)}` : '';
    return this.request<{
      month: string;
      items: import('@smartresidence/shared-types').OvernightUnitSummary[];
      settings: import('@smartresidence/shared-types').CondoVisitorSettings;
    }>('GET', `/api/visitors/admin/overnight-summary/${condoId}${qs}`);
  }
  suspendUnitOvernight(
    condoId: string,
    unitId: string,
    body: { reason: string; until?: string; indefinite?: boolean },
  ) {
    const qs = `?condoId=${encodeURIComponent(condoId)}`;
    return this.request(
      'PATCH',
      `/api/visitors/admin/overnight-policy/${unitId}/suspend${qs}`,
      body,
    );
  }
  unsuspendUnitOvernight(condoId: string, unitId: string) {
    const qs = `?condoId=${encodeURIComponent(condoId)}`;
    return this.request('PATCH', `/api/visitors/admin/overnight-policy/${unitId}/unsuspend${qs}`);
  }
  flagVisitorPlateMismatch(
    visitorId: string,
    body: { reason?: string; suspendOwner?: boolean } = {},
  ) {
    return this.request<Visitor>('POST', `/api/visitors/${visitorId}/flag-plate-mismatch`, body);
  }
  rejectVisitor(visitorId: string, reason?: string) {
    return this.request<Visitor>('POST', `/api/visitors/${visitorId}/reject`, { reason });
  }
  guardWalkInPolicy() {
    return this.request<{
      walkInRequireOwnerApproval: boolean;
      walkInApprovalMinutes: number;
    }>('GET', '/api/visitors/guard/walk-in-policy');
  }
  guardLiveVisitors() {
    return this.request<import('@smartresidence/shared-types').GuardLiveVisitorsResponse>(
      'GET',
      '/api/visitors/guard/live',
    );
  }
  createWalkInUnit(input: import('@smartresidence/shared-types').CreateWalkInUnitInput) {
    return this.request<Visitor>('POST', '/api/visitors/walk-in/unit', input);
  }

  /**
   * Guard admits a unit walk-in on the spot (on-site discretion): the visitor is
   * checked in immediately without owner pre-registration/approval. Recorded
   * against the guard; the unit owner is notified for transparency.
   */
  admitWalkInUnit(
    input: Omit<import('@smartresidence/shared-types').CreateWalkInUnitInput, 'admitNow'>,
  ) {
    return this.request<Visitor>('POST', '/api/visitors/walk-in/unit', {
      ...input,
      admitNow: true,
    });
  }
  walkInOwnerContacts(visitorId: string) {
    return this.request<{
      visitorId: string;
      ownerContacts: import('@smartresidence/shared-types').WalkInOwnerContact[];
    }>('GET', `/api/visitors/${visitorId}/walk-in-owner-contacts`);
  }
  createWalkInOffice(input: import('@smartresidence/shared-types').CreateWalkInOfficeInput) {
    return this.request<Visitor>('POST', '/api/visitors/walk-in/office', input);
  }
  cancelVisitor(visitorId: string) {
    return this.request<void>('DELETE', `/api/visitors/${visitorId}`);
  }
  verifyVisitorPass(pass: string) {
    return this.request<Visitor>('POST', `/api/visitors/verify/${encodeURIComponent(pass)}`);
  }
  /** @deprecated Use verifyVisitorPass */
  verifyQr(qr: string) {
    return this.verifyVisitorPass(qr);
  }
  checkInVisitor(pass: string, body: { gateLocation?: string; notes?: string } = {}) {
    return this.request('POST', `/api/visitors/check-in/${encodeURIComponent(pass)}`, body);
  }
  checkOutVisitor(pass: string) {
    return this.request('POST', `/api/visitors/check-out/${encodeURIComponent(pass)}`);
  }
  checkOutVisitorById(visitorId: string) {
    return this.request('POST', `/api/visitors/${encodeURIComponent(visitorId)}/check-out`);
  }

  visitorBlacklist(condoId: string) {
    return this.request<{ items: VisitorBlacklist[]; total: number }>(
      'GET',
      `/api/visitors/admin/blacklist/${condoId}`,
    );
  }
  createVisitorBlacklist(condoId: string, input: CreateVisitorBlacklistInput) {
    return this.request<VisitorBlacklist>(
      'POST',
      `/api/visitors/admin/blacklist/${condoId}`,
      input,
    );
  }
  updateVisitorBlacklist(id: string, input: UpdateVisitorBlacklistInput) {
    return this.request<VisitorBlacklist>('PATCH', `/api/visitors/admin/blacklist/${id}`, input);
  }
  deleteVisitorBlacklist(id: string) {
    return this.request<void>('DELETE', `/api/visitors/admin/blacklist/${id}`);
  }
  guardBlacklistCheck(input: {
    name?: string;
    phone?: string;
    vehiclePlate?: string;
    idNumber?: string;
  }) {
    return this.request<{ blocked: boolean; reason?: string; entryId?: string }>(
      'POST',
      '/api/visitors/guard/blacklist-check',
      input,
    );
  }

  recurringPassesForUnit(unitId: string) {
    return this.request<{ items: RecurringPass[]; total: number }>(
      'GET',
      `/api/visitors/recurring-passes/unit/${unitId}`,
    );
  }
  recurringPassesForCondo(condoId: string) {
    return this.request<{ items: RecurringPass[]; total: number }>(
      'GET',
      `/api/visitors/recurring-passes/condo/${condoId}`,
    );
  }
  createRecurringPass(input: CreateRecurringPassInput) {
    return this.request<RecurringPass>('POST', '/api/visitors/recurring-passes', input);
  }
  updateRecurringPass(id: string, input: UpdateRecurringPassInput) {
    return this.request<RecurringPass>('PATCH', `/api/visitors/recurring-passes/${id}`, input);
  }
  deleteRecurringPass(id: string) {
    return this.request<void>('DELETE', `/api/visitors/recurring-passes/${id}`);
  }
  verifyRecurringPass(pass: string) {
    return this.request<RecurringPassVerify>(
      'POST',
      `/api/visitors/recurring-passes/verify/${encodeURIComponent(pass)}`,
    );
  }
  checkInRecurringPass(pass: string, body: { gateLocation?: string; notes?: string } = {}) {
    return this.request(
      'POST',
      `/api/visitors/recurring-passes/check-in/${encodeURIComponent(pass)}`,
      body,
    );
  }

  // Billing ----------------------------------------------------------
  invoicesForUnit(unitId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: Invoice[]; total: number }>(
      'GET',
      `/api/invoices/unit/${unitId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  invoicesForCondo(
    condoId: string,
    params: { status?: string; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    return this.request<{ items: Invoice[]; total: number }>(
      'GET',
      `/api/invoices/condo/${condoId}${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  invoice(id: string) {
    return this.request<Invoice>('GET', `/api/invoices/${id}`);
  }
  payInvoice(id: string, body: { provider: string; returnUrl?: string }) {
    return this.request<PaymentIntentResponse>('POST', `/api/invoices/${id}/payments`, body);
  }
  pollDuitNowInvoiceStatus(paymentId: string) {
    return this.request<import('@smartresidence/shared-types').DuitNowQrPollResponse>(
      'GET',
      `/api/invoices/payments/${paymentId}/duitnow-status`,
    );
  }
  pollDuitNowAdvanceStatus(advancePaymentId: string) {
    return this.request<import('@smartresidence/shared-types').DuitNowQrPollResponse>(
      'GET',
      `/api/invoices/advance-payments/${advancePaymentId}/duitnow-status`,
    );
  }
  createAdvancePayment(input: CreateAdvancePaymentInput) {
    return this.request<PaymentIntentResponse>('POST', '/api/invoices/prepayment/intent', input);
  }
  recordManualPayment(
    id: string,
    body: import('@smartresidence/shared-types').RecordManualPaymentInput,
  ) {
    return this.request<Invoice>('POST', `/api/invoices/${id}/manual-payment`, body);
  }
  voidInvoice(id: string, reason?: string) {
    return this.request<Invoice>('POST', `/api/invoices/${id}/void`, { reason });
  }
  generateRecurringInvoices(
    condoId: string,
    body: import('@smartresidence/shared-types').GenerateRecurringInput,
  ) {
    return this.request<{
      created: number;
      skipped: number;
      skippedNoRate: number;
      units: number;
    }>('POST', `/api/invoices/condo/${condoId}/generate-recurring`, body);
  }
  runInvoiceDueSweep(condoId: string) {
    return this.request<{ overdue: number; dueSoonNotified: number; sweptAt: string }>(
      'POST',
      `/api/invoices/condo/${condoId}/run-due-sweep`,
    );
  }

  // Deposits & receipts ----------------------------------------------
  depositsForCondo(
    condoId: string,
    params: { status?: string; unitId?: string; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.unitId) qs.set('unitId', params.unitId);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    return this.request<{ items: DepositListItem[]; total: number }>(
      'GET',
      `/api/deposits/condo/${condoId}${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  depositsForUnit(unitId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: DepositListItem[]; total: number }>(
      'GET',
      `/api/deposits/unit/${unitId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  recordDeposit(input: RecordDepositInput) {
    return this.request<DepositListItem>('POST', '/api/deposits', input);
  }
  refundDeposit(id: string, input: RefundDepositInput) {
    return this.request<DepositListItem>('POST', `/api/deposits/${id}/refund`, input);
  }
  receiptsForCondo(
    condoId: string,
    params: { kind?: string; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.kind) qs.set('kind', params.kind);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    return this.request<{ items: ReceiptListItem[]; total: number }>(
      'GET',
      `/api/receipts/condo/${condoId}${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  receiptsForUnit(unitId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: ReceiptListItem[]; total: number }>(
      'GET',
      `/api/receipts/unit/${unitId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  async downloadReceiptPdf(id: string): Promise<Blob> {
    const headers: Record<string, string> = { Accept: 'application/pdf' };
    const token = await this.cfg.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const condoId = await this.cfg.getActiveCondoId?.();
    if (condoId) headers['x-condo-id'] = condoId;
    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const res = await fetchImpl(`${this.cfg.baseUrl}/api/receipts/${id}/pdf`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* ignore */
      }
      const message =
        (parsed as { message?: string } | null)?.message ?? `HTTP ${res.status} ${res.statusText}`;
      throw new ApiError(res.status, parsed, message);
    }
    return res.blob();
  }

  // Billing settings (fee schedule + receipt template) ---------------
  feeRates(condoId: string) {
    return this.request<FeeRateRow[]>('GET', `/api/settings/condo/${condoId}/billing/fee-rates`);
  }
  upsertFeeRate(condoId: string, input: UpsertFeeRateInput) {
    return this.request<UnitTypeFeeRate>(
      'PUT',
      `/api/settings/condo/${condoId}/billing/fee-rates`,
      input,
    );
  }
  deleteFeeRate(condoId: string, unitTypeId: string) {
    return this.request<{ deleted: boolean }>(
      'DELETE',
      `/api/settings/condo/${condoId}/billing/fee-rates/${unitTypeId}`,
    );
  }
  feeExtraLines(condoId: string) {
    return this.request<FeeScheduleExtraLine[]>(
      'GET',
      `/api/settings/condo/${condoId}/billing/fee-extra-lines`,
    );
  }
  upsertFeeExtraLine(condoId: string, input: UpsertFeeScheduleExtraLineInput) {
    return this.request<FeeScheduleExtraLine>(
      'PUT',
      `/api/settings/condo/${condoId}/billing/fee-extra-lines`,
      input,
    );
  }
  addFeeExtraLinePresets(condoId: string, input: AddFeeSchedulePresetsInput) {
    return this.request<{
      created: number;
      skipped: number;
      items: FeeScheduleExtraLine[];
    }>('POST', `/api/settings/condo/${condoId}/billing/fee-extra-lines/presets`, input);
  }
  deleteFeeExtraLine(condoId: string, id: string) {
    return this.request<{ deleted: boolean }>(
      'DELETE',
      `/api/settings/condo/${condoId}/billing/fee-extra-lines/${id}`,
    );
  }
  receiptTemplate(condoId: string) {
    return this.request<ReceiptTemplateConfig>(
      'GET',
      `/api/settings/condo/${condoId}/billing/receipt-template`,
    );
  }
  updateReceiptTemplate(condoId: string, input: Partial<ReceiptTemplateConfig>) {
    return this.request<ReceiptTemplateConfig>(
      'PATCH',
      `/api/settings/condo/${condoId}/billing/receipt-template`,
      input,
    );
  }
  billingAutomation(condoId: string) {
    return this.request<BillingAutomationSettings>(
      'GET',
      `/api/settings/condo/${condoId}/billing/automation`,
    );
  }
  updateBillingAutomation(condoId: string, input: Partial<BillingAutomationSettings>) {
    return this.request<BillingAutomationSettings>(
      'PATCH',
      `/api/settings/condo/${condoId}/billing/automation`,
      input,
    );
  }
  previewBillingAutomation(condoId: string) {
    return this.request<BillingAutomationPreview>(
      'GET',
      `/api/settings/condo/${condoId}/billing/automation/preview`,
    );
  }
  runBillingAutomation(condoId: string, input: { dryRun?: boolean } = {}) {
    return this.request<BillingAutomationRunResult>(
      'POST',
      `/api/settings/condo/${condoId}/billing/automation/run`,
      input,
    );
  }
  automationStatus(condoId: string) {
    return this.request<AutomationStatusResponse>(
      'GET',
      `/api/automations/condo/${condoId}/status`,
    );
  }

  // First-time setup / onboarding (F4) -------------------------------
  getSetupStatus(condoId: string) {
    return this.request<SetupStatus>('GET', `/api/setup/condo/${condoId}`);
  }
  updateSetupStep(condoId: string, input: UpdateSetupStepInput) {
    return this.request<SetupStatus>('PATCH', `/api/setup/condo/${condoId}`, input);
  }
  completeSetup(condoId: string) {
    return this.request<SetupStatus>('POST', `/api/setup/condo/${condoId}/complete`);
  }
  dismissSetup(condoId: string) {
    return this.request<SetupStatus>('POST', `/api/setup/condo/${condoId}/dismiss`);
  }

  // Accounting reports & prepayments ---------------------------------
  recordPrepayment(input: RecordPrepaymentInput) {
    return this.request<{ credit: number; receiptId: string }>(
      'POST',
      '/api/billing/prepayment',
      input,
    );
  }
  fundBalances(condoId: string) {
    return this.request<FundBalance[]>(
      'GET',
      `/api/billing/reports/condo/${condoId}/fund-balances`,
    );
  }
  collectionsSummary(condoId: string, params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.request<CollectionsSummary>(
      'GET',
      `/api/billing/reports/condo/${condoId}/collections${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  arrearsAging(condoId: string) {
    return this.request<ArrearsAging>('GET', `/api/billing/reports/condo/${condoId}/arrears`);
  }
  fundSummary(condoId: string, params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.request<FundSummaryReport>(
      'GET',
      `/api/billing/reports/condo/${condoId}/fund-summary${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  incomeExpense(condoId: string, params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.request<IncomeExpenseReport>(
      'GET',
      `/api/billing/reports/condo/${condoId}/income-expense${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  profitLoss(condoId: string, params: { from?: string; to?: string; fund?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.fund) qs.set('fund', params.fund);
    return this.request<ProfitLossReport>(
      'GET',
      `/api/billing/reports/condo/${condoId}/profit-loss${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  balanceSheet(condoId: string, params: { asOf?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.asOf) qs.set('asOf', params.asOf);
    return this.request<BalanceSheetReport>(
      'GET',
      `/api/billing/reports/condo/${condoId}/balance-sheet${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  paymentIssues(condoId: string) {
    return this.request<PaymentIssue[]>('GET', `/api/billing/payments/condo/${condoId}/issues`);
  }
  dismissPayment(paymentId: string) {
    return this.request<{ id: string }>('POST', `/api/billing/payments/${paymentId}/dismiss`);
  }
  approveReviewedPayment(paymentId: string) {
    return this.request<{ id: string }>(
      'POST',
      `/api/billing/payments/${paymentId}/approve-review`,
    );
  }
  unitStatement(unitId: string) {
    return this.request<UnitStatement>('GET', `/api/billing/statements/unit/${unitId}`);
  }

  chartOfAccounts(condoId: string) {
    return this.request<GlAccountNode[]>('GET', `/api/accounting/condo/${condoId}/coa`);
  }
  glBankAccounts(condoId: string) {
    return this.request<Array<{ id: string; code: string; name: string; fund: string }>>(
      'GET',
      `/api/accounting/condo/${condoId}/bank-accounts`,
    );
  }
  glJournals(condoId: string, params: { from?: string; to?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.limit != null) qs.set('limit', String(params.limit));
    return this.request<GlJournalListItem[]>(
      'GET',
      `/api/accounting/condo/${condoId}/journals${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  glJournalDetail(condoId: string, entryId: string) {
    return this.request<GlJournalEntryDetail>(
      'GET',
      `/api/accounting/condo/${condoId}/journals/${entryId}`,
    );
  }
  postManualJournal(condoId: string, input: PostManualJournalInput) {
    return this.request<GlJournalEntryDetail>(
      'POST',
      `/api/accounting/condo/${condoId}/journals`,
      input,
    );
  }
  bankStatementImports(condoId: string, accountId?: string) {
    const qs = accountId ? `?accountId=${accountId}` : '';
    return this.request<BankStatementImportSummary[]>(
      'GET',
      `/api/accounting/condo/${condoId}/bank-imports${qs}`,
    );
  }
  importBankStatement(condoId: string, input: ImportBankStatementInput) {
    return this.request<{ id: string }>(
      'POST',
      `/api/accounting/condo/${condoId}/bank-imports`,
      input,
    );
  }
  bankReconciliationWorksheet(condoId: string, importId: string) {
    return this.request<BankReconciliationWorksheet>(
      'GET',
      `/api/accounting/condo/${condoId}/bank-imports/${importId}/worksheet`,
    );
  }
  matchBankStatementLine(condoId: string, lineId: string, journalLineId: string | null) {
    return this.request<{ id: string }>(
      'POST',
      `/api/accounting/condo/${condoId}/bank-lines/${lineId}/match`,
      { journalLineId },
    );
  }

  private async downloadBillingBlob(path: string, accept: string): Promise<Blob> {
    const headers: Record<string, string> = { Accept: accept };
    const token = await this.cfg.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const condoId = await this.cfg.getActiveCondoId?.();
    if (condoId) headers['x-condo-id'] = condoId;
    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const res = await fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* ignore */
      }
      const message =
        (parsed as { message?: string } | null)?.message ?? `HTTP ${res.status} ${res.statusText}`;
      throw new ApiError(res.status, parsed, message);
    }
    return res.blob();
  }
  async downloadUnitStatementPdf(
    condoId: string,
    unitId: string,
    params: { from?: string; to?: string } = {},
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.downloadBillingBlob(
      `/api/billing/condo/${condoId}/statements/unit/${unitId}.pdf${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'application/pdf',
    );
  }
  async downloadCollectionsCsv(
    condoId: string,
    params: { from?: string; to?: string } = {},
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.downloadBillingBlob(
      `/api/billing/condo/${condoId}/exports/collections.csv${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'text/csv',
    );
  }
  async downloadArrearsCsv(condoId: string): Promise<Blob> {
    return this.downloadBillingBlob(
      `/api/billing/condo/${condoId}/exports/arrears.csv`,
      'text/csv',
    );
  }
  async downloadFundSummaryPdf(
    condoId: string,
    params: { from?: string; to?: string } = {},
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.downloadBillingBlob(
      `/api/billing/condo/${condoId}/exports/fund-summary.pdf${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'application/pdf',
    );
  }
  async downloadAuditTrailCsv(
    condoId: string,
    params: { from?: string; to?: string } = {},
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.downloadBillingBlob(
      `/api/billing/reports/condo/${condoId}/audit-trail.csv${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'text/csv',
    );
  }
  async downloadProfitLossPdf(
    condoId: string,
    params: { from?: string; to?: string; fund?: string } = {},
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.fund) qs.set('fund', params.fund);
    return this.downloadBillingBlob(
      `/api/billing/reports/condo/${condoId}/profit-loss.pdf${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'application/pdf',
    );
  }
  async downloadProfitLossCsv(
    condoId: string,
    params: { from?: string; to?: string; fund?: string } = {},
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.fund) qs.set('fund', params.fund);
    return this.downloadBillingBlob(
      `/api/billing/reports/condo/${condoId}/profit-loss.csv${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'text/csv',
    );
  }
  async downloadBalanceSheetPdf(condoId: string, params: { asOf?: string } = {}): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.asOf) qs.set('asOf', params.asOf);
    return this.downloadBillingBlob(
      `/api/billing/reports/condo/${condoId}/balance-sheet.pdf${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'application/pdf',
    );
  }
  async downloadBalanceSheetCsv(condoId: string, params: { asOf?: string } = {}): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.asOf) qs.set('asOf', params.asOf);
    return this.downloadBillingBlob(
      `/api/billing/reports/condo/${condoId}/balance-sheet.csv${
        qs.toString() ? `?${qs.toString()}` : ''
      }`,
      'text/csv',
    );
  }

  // COB compliance templates -----------------------------------------
  listCobTemplates(condoId: string, params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.request<CobTemplateListResponse>(
      'GET',
      `/api/cob/condo/${condoId}/templates${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }
  async downloadCobTemplatePdf(
    condoId: string,
    slug: string,
    params: { from?: string; to?: string } = {},
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return this.downloadBillingBlob(
      `/api/cob/condo/${condoId}/templates/${slug}.pdf${qs.toString() ? `?${qs.toString()}` : ''}`,
      'application/pdf',
    );
  }

  // Payment gateways -------------------------------------------------
  listGateways(condoId: string) {
    return this.request<GatewayConnectionView[]>(
      'GET',
      `/api/settings/condo/${condoId}/billing/gateways`,
    );
  }
  upsertGateway(condoId: string, input: UpsertGatewayInput) {
    return this.request<GatewayConnectionView>(
      'PUT',
      `/api/settings/condo/${condoId}/billing/gateways`,
      input,
    );
  }
  setGatewayEnabled(condoId: string, id: string, enabled: boolean) {
    return this.request<GatewayConnectionView>(
      'POST',
      `/api/settings/condo/${condoId}/billing/gateways/${id}/enabled`,
      { enabled },
    );
  }
  deleteGateway(condoId: string, id: string) {
    return this.request<{ deleted: boolean }>(
      'DELETE',
      `/api/settings/condo/${condoId}/billing/gateways/${id}`,
    );
  }

  // E-invoice (LHDN MyInvois) ----------------------------------------
  eInvoiceConfig(condoId: string) {
    return this.request<EInvoiceConfigView>('GET', `/api/einvoice/condo/${condoId}/config`);
  }
  updateEInvoiceConfig(condoId: string, input: UpdateEInvoiceConfigInput) {
    return this.request<EInvoiceConfigView>('PUT', `/api/einvoice/condo/${condoId}/config`, input);
  }
  eInvoiceForInvoice(invoiceId: string) {
    return this.request<EInvoiceView | null>('GET', `/api/einvoice/invoice/${invoiceId}`);
  }
  submitEInvoice(invoiceId: string) {
    return this.request<EInvoiceView>('POST', `/api/einvoice/invoice/${invoiceId}/submit`);
  }
  cancelEInvoice(invoiceId: string, input: CancelEInvoiceInput = {}) {
    return this.request<EInvoiceView>('POST', `/api/einvoice/invoice/${invoiceId}/cancel`, input);
  }

  // WhatsApp notifications -------------------------------------------
  whatsAppConfig(condoId: string) {
    return this.request<import('@smartresidence/shared-types').WhatsAppConfigView>(
      'GET',
      `/api/notifications/condo/${condoId}/whatsapp/config`,
    );
  }
  updateWhatsAppConfig(
    condoId: string,
    input: import('@smartresidence/shared-types').UpdateWhatsAppConfigInput,
  ) {
    return this.request<import('@smartresidence/shared-types').WhatsAppConfigView>(
      'PUT',
      `/api/notifications/condo/${condoId}/whatsapp/config`,
      input,
    );
  }
  testWhatsAppSend(condoId: string, phone: string) {
    return this.request<import('@smartresidence/shared-types').WhatsAppTestSendResult>(
      'POST',
      `/api/notifications/condo/${condoId}/whatsapp/test`,
      { phone },
    );
  }

  // MCP integrations -------------------------------------------------
  listMcpServers(condoId: string) {
    return this.request<McpServerConnectionView[]>(
      'GET',
      `/api/settings/condo/${condoId}/integrations/mcp`,
    );
  }
  upsertMcpServer(condoId: string, input: UpsertMcpServerInput) {
    return this.request<McpServerConnectionView>(
      'PUT',
      `/api/settings/condo/${condoId}/integrations/mcp`,
      input,
    );
  }
  testMcpServer(condoId: string, id: string) {
    return this.request<McpConnectionTestResult>(
      'POST',
      `/api/settings/condo/${condoId}/integrations/mcp/${id}/test`,
    );
  }
  setMcpServerEnabled(condoId: string, id: string, enabled: boolean) {
    return this.request<McpServerConnectionView>(
      'POST',
      `/api/settings/condo/${condoId}/integrations/mcp/${id}/enabled`,
      { enabled },
    );
  }
  deleteMcpServer(condoId: string, id: string) {
    return this.request<{ deleted: boolean }>(
      'DELETE',
      `/api/settings/condo/${condoId}/integrations/mcp/${id}`,
    );
  }

  payableMethods(condoId: string) {
    return this.request<PayableMethod[]>('GET', `/api/billing/condo/${condoId}/payment-methods`);
  }

  // Defects ----------------------------------------------------------
  createDefect(input: CreateDefectInput) {
    return this.request<unknown>('POST', '/api/defects', input);
  }
  defectsForUnit(unitId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/api/defects/unit/${unitId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  defectsForCondo(
    condoId: string,
    params: { status?: string; limit?: number; offset?: number } = {},
  ) {
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/api/defects/condo/${condoId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  defect(id: string) {
    return this.request<unknown>('GET', `/api/defects/${id}`);
  }
  transitionDefect(
    id: string,
    body: { status: string; message?: string; assignedToUserId?: string },
  ) {
    return this.request<unknown>('PATCH', `/api/defects/${id}/status`, body);
  }
  addDefectUpdate(
    id: string,
    body: { message: string; isInternal?: boolean; attachmentIds?: string[] },
  ) {
    return this.request<unknown>('POST', `/api/defects/${id}/updates`, body);
  }
  /** Download the condo defect schedule as a PDF (management only). */
  async exportCondoDefectsPdf(
    condoId: string,
    params: { status?: string; severity?: string; category?: string } = {},
  ): Promise<Blob> {
    const headers: Record<string, string> = { Accept: 'application/pdf' };
    const token = await this.cfg.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const activeCondoId = await this.cfg.getActiveCondoId?.();
    if (activeCondoId) headers['x-condo-id'] = activeCondoId;
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => Boolean(v) && v !== 'ALL') as [string, string][],
      ),
    ).toString();
    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const res = await fetchImpl(
      `${this.cfg.baseUrl}/api/defects/condo/${condoId}/export.pdf${query ? `?${query}` : ''}`,
      { method: 'GET', headers, credentials: 'include' },
    );
    if (!res.ok) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* ignore */
      }
      const message =
        (parsed as { message?: string } | null)?.message ?? `HTTP ${res.status} ${res.statusText}`;
      throw new ApiError(res.status, parsed, message);
    }
    return res.blob();
  }

  // Announcements ----------------------------------------------------
  announcementsForCondo(
    condoId: string,
    params: {
      limit?: number;
      offset?: number;
      manage?: boolean;
      category?: AnnouncementCategory;
      includeStats?: boolean;
    } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.manage) qs.set('manage', 'true');
    if (params.category) qs.set('category', params.category);
    if (params.includeStats) qs.set('includeStats', 'true');
    const query = qs.toString();
    return this.request<{ items: Announcement[]; total: number }>(
      'GET',
      `/api/announcements/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  announcement(id: string) {
    return this.request<Announcement>('GET', `/api/announcements/${id}`);
  }
  announcementReadStats(id: string) {
    return this.request<AnnouncementReadStats>('GET', `/api/announcements/${id}/stats`);
  }
  createAnnouncement(input: CreateAnnouncementInput) {
    return this.request<Announcement>('POST', '/api/announcements', input);
  }
  updateAnnouncement(id: string, body: UpdateAnnouncementInput) {
    return this.request<Announcement>('PATCH', `/api/announcements/${id}`, body);
  }
  deleteAnnouncement(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/announcements/${id}`);
  }
  markAnnouncementRead(id: string) {
    return this.request<{ ok: boolean }>('POST', `/api/announcements/${id}/read`);
  }
  ackAnnouncement(id: string) {
    return this.request<{ ok: boolean }>('POST', `/api/announcements/${id}/ack`);
  }

  // Polls (owner-verified governance) --------------------------------
  pollsForCondo(
    condoId: string,
    params: { limit?: number; offset?: number; manage?: boolean } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.manage) qs.set('manage', 'true');
    const query = qs.toString();
    return this.request<{ items: Poll[]; total: number }>(
      'GET',
      `/api/polls/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  poll(id: string) {
    return this.request<Poll>('GET', `/api/polls/${id}`);
  }
  createPoll(input: CreatePollInput) {
    return this.request<Poll>('POST', '/api/polls', input);
  }
  updatePoll(id: string, body: UpdatePollInput) {
    return this.request<Poll>('PATCH', `/api/polls/${id}`, body);
  }
  castPollVote(id: string, body: CastPollVoteInput) {
    return this.request<PollMyVote[]>('POST', `/api/polls/${id}/vote`, body);
  }
  myPollVotes(id: string) {
    return this.request<PollMyVote[]>('GET', `/api/polls/${id}/my-votes`);
  }

  // Facility / amenity booking (§4.6) --------------------------------
  facilitiesForCondo(
    condoId: string,
    params: { includeInactive?: boolean; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.includeInactive) qs.set('includeInactive', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: Facility[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/facilities/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  facility(id: string) {
    return this.request<Facility>('GET', `/api/facilities/${id}`);
  }
  facilityAvailability(id: string, date: string) {
    return this.request<FacilityAvailability>(
      'GET',
      `/api/facilities/${id}/availability?date=${encodeURIComponent(date)}`,
    );
  }
  createFacility(input: CreateFacilityInput) {
    return this.request<Facility>('POST', '/api/facilities', input);
  }
  updateFacility(id: string, body: UpdateFacilityInput) {
    return this.request<Facility>('PATCH', `/api/facilities/${id}`, body);
  }
  deleteFacility(id: string) {
    return this.request<{ ok: boolean } | Facility>('DELETE', `/api/facilities/${id}`);
  }
  createBooking(input: CreateBookingInput) {
    return this.request<Booking>('POST', '/api/bookings', input);
  }
  myBookings(params: { limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: Booking[]; total: number }>(
      'GET',
      `/api/bookings/mine${query ? `?${query}` : ''}`,
    );
  }
  condoBookings(
    condoId: string,
    params: {
      status?: string;
      facilityId?: string;
      upcoming?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.facilityId) qs.set('facilityId', params.facilityId);
    if (params.upcoming) qs.set('upcoming', 'true');
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: Booking[]; total: number }>(
      'GET',
      `/api/bookings/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  cancelBooking(id: string, reason?: string) {
    return this.request<Booking>('POST', `/api/bookings/${id}/cancel`, { reason });
  }
  approveBooking(id: string) {
    return this.request<Booking>('POST', `/api/bookings/${id}/approve`);
  }
  rejectBooking(id: string, reason?: string) {
    return this.request<Booking>('POST', `/api/bookings/${id}/reject`, { reason });
  }

  // Condo forms & workflows -------------------------------------------
  formTemplatesForCondo(
    condoId: string,
    params: { includeInactive?: boolean; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.includeInactive) qs.set('includeInactive', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: FormTemplate[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/form-templates/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  formTemplate(id: string) {
    return this.request<FormTemplate>('GET', `/api/form-templates/${id}`);
  }
  createFormTemplate(input: CreateFormTemplateInput) {
    return this.request<FormTemplate>('POST', '/api/form-templates', input);
  }
  updateFormTemplate(id: string, body: UpdateFormTemplateInput) {
    return this.request<FormTemplate>('PATCH', `/api/form-templates/${id}`, body);
  }
  deleteFormTemplate(id: string) {
    return this.request<FormTemplate | { ok: boolean }>('DELETE', `/api/form-templates/${id}`);
  }
  createFormSubmission(input: CreateFormSubmissionInput) {
    return this.request<FormSubmission>('POST', '/api/form-submissions', input);
  }
  updateFormSubmission(id: string, body: UpdateFormSubmissionInput) {
    return this.request<FormSubmission>('PATCH', `/api/form-submissions/${id}`, body);
  }
  myFormSubmissions(params: { limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: FormSubmission[]; total: number }>(
      'GET',
      `/api/form-submissions/mine${query ? `?${query}` : ''}`,
    );
  }
  condoFormSubmissions(
    condoId: string,
    params: { status?: string; templateId?: string; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.templateId) qs.set('templateId', params.templateId);
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: FormSubmission[]; total: number }>(
      'GET',
      `/api/form-submissions/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  formSubmission(id: string) {
    return this.request<FormSubmission>('GET', `/api/form-submissions/${id}`);
  }
  cancelFormSubmission(id: string) {
    return this.request<FormSubmission>('POST', `/api/form-submissions/${id}/cancel`);
  }
  approveFormSubmission(id: string) {
    return this.request<FormSubmission>('POST', `/api/form-submissions/${id}/approve`);
  }
  rejectFormSubmission(id: string, body: RejectFormSubmissionInput = {}) {
    return this.request<FormSubmission>('POST', `/api/form-submissions/${id}/reject`, body);
  }

  // Documents vault ---------------------------------------------------
  documentFoldersForCondo(condoId: string, params: { includeInactive?: boolean } = {}) {
    const qs = params.includeInactive ? '?includeInactive=true' : '';
    return this.request<DocumentFolder[]>('GET', `/api/document-folders/condo/${condoId}${qs}`);
  }
  createDocumentFolder(input: CreateDocumentFolderInput) {
    return this.request<DocumentFolder>('POST', '/api/document-folders', input);
  }
  updateDocumentFolder(id: string, body: UpdateDocumentFolderInput) {
    return this.request<DocumentFolder>('PATCH', `/api/document-folders/${id}`, body);
  }
  deleteDocumentFolder(id: string) {
    return this.request<{ ok: boolean; deactivated?: boolean }>(
      'DELETE',
      `/api/document-folders/${id}`,
    );
  }
  condoDocuments(
    condoId: string,
    params: { folderId?: string; includeInactive?: boolean; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.folderId) qs.set('folderId', params.folderId);
    if (params.includeInactive) qs.set('includeInactive', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: Document[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/documents/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  document(id: string) {
    return this.request<Document>('GET', `/api/documents/${id}`);
  }
  createDocument(input: CreateDocumentInput) {
    return this.request<Document>('POST', '/api/documents', input);
  }
  updateDocument(id: string, body: UpdateDocumentInput) {
    return this.request<Document>('PATCH', `/api/documents/${id}`, body);
  }
  deleteDocument(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/documents/${id}`);
  }
  documentVersions(documentId: string) {
    return this.request<DocumentVersion[]>('GET', `/api/documents/${documentId}/versions`);
  }
  publishDocumentVersion(documentId: string, input: PublishDocumentVersionInput) {
    return this.request<DocumentVersion>('POST', `/api/documents/${documentId}/versions`, input);
  }
  documentVersionDownloadUrl(versionId: string) {
    return this.request<DocumentDownloadUrl>('GET', `/api/document-versions/${versionId}/download`);
  }

  // Guard safety: panic / SOS -----------------------------------------
  raiseSos(input: RaiseSosInput) {
    return this.request<SosAlert>('POST', '/api/sos', input);
  }
  mySosAlerts(params: { limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: SosAlert[]; total: number }>(
      'GET',
      `/api/sos/mine${query ? `?${query}` : ''}`,
    );
  }
  condoSosAlerts(condoId: string) {
    return this.request<SosCondoResponse>('GET', `/api/sos/condo/${condoId}`);
  }
  sosAlert(id: string) {
    return this.request<SosAlert>('GET', `/api/sos/${id}`);
  }
  acknowledgeSos(id: string) {
    return this.request<SosAlert>('POST', `/api/sos/${id}/acknowledge`);
  }
  resolveSos(id: string, input: ResolveSosInput = {}) {
    return this.request<SosAlert>('POST', `/api/sos/${id}/resolve`, input);
  }
  cancelSos(id: string) {
    return this.request<SosAlert>('POST', `/api/sos/${id}/cancel`);
  }

  // Guard safety: patrol checkpoints + scans --------------------------
  patrolCheckpoints(condoId: string, params: { includeInactive?: boolean } = {}) {
    const qs = params.includeInactive ? '?includeInactive=true' : '';
    return this.request<PatrolCheckpointStatus[]>(
      'GET',
      `/api/patrol/condo/${condoId}/checkpoints${qs}`,
    );
  }
  patrolScans(
    condoId: string,
    params: {
      checkpointId?: string;
      guardUserId?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const query = qs.toString();
    return this.request<{ items: PatrolScan[]; total: number }>(
      'GET',
      `/api/patrol/condo/${condoId}/scans${query ? `?${query}` : ''}`,
    );
  }
  createPatrolCheckpoint(input: CreatePatrolCheckpointInput) {
    return this.request<PatrolCheckpoint>('POST', '/api/patrol/checkpoints', input);
  }
  updatePatrolCheckpoint(id: string, input: UpdatePatrolCheckpointInput) {
    return this.request<PatrolCheckpoint>('PATCH', `/api/patrol/checkpoints/${id}`, input);
  }
  regeneratePatrolCode(id: string) {
    return this.request<PatrolCheckpoint>('POST', `/api/patrol/checkpoints/${id}/regenerate-code`);
  }
  deletePatrolCheckpoint(id: string) {
    return this.request<{ ok: boolean } | PatrolCheckpoint>(
      'DELETE',
      `/api/patrol/checkpoints/${id}`,
    );
  }
  scanPatrolCheckpoint(input: PatrolScanInput) {
    return this.request<PatrolScan>('POST', '/api/patrol/scan', input);
  }

  // Parcels / deliveries --------------------------------------------
  parcelsForCondo(
    condoId: string,
    params: {
      status?: string;
      unitId?: string;
      pendingOnly?: boolean;
      limit?: number;
      offset?: number;
      from?: string;
      to?: string;
    } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.unitId) qs.set('unitId', params.unitId);
    if (params.pendingOnly) qs.set('pendingOnly', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const query = qs.toString();
    return this.request<{ items: Parcel[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/parcels/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  parcelsForUnit(
    unitId: string,
    params: { status?: string; pendingOnly?: boolean; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.pendingOnly) qs.set('pendingOnly', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return this.request<{ items: Parcel[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/parcels/unit/${unitId}${query ? `?${query}` : ''}`,
    );
  }
  parcel(id: string) {
    return this.request<Parcel>('GET', `/api/parcels/${id}`);
  }
  createParcel(input: CreateParcelInput) {
    return this.request<Parcel>('POST', '/api/parcels', input);
  }
  collectParcel(id: string, input: CollectParcelInput = {}) {
    return this.request<Parcel>('POST', `/api/parcels/${id}/collect`, input);
  }

  // Governance — general meetings (AGM/EGM) --------------------------
  meetingsForCondo(
    condoId: string,
    params: { manage?: boolean; limit?: number; offset?: number } = {},
  ) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)] as [string, string]),
    ).toString();
    return this.request<{ items: GeneralMeeting[]; total: number }>(
      'GET',
      `/api/governance/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  meeting(id: string) {
    return this.request<GeneralMeeting>('GET', `/api/governance/${id}`);
  }
  createMeeting(input: CreateGeneralMeetingInput) {
    return this.request<GeneralMeeting>('POST', '/api/governance', input);
  }
  updateMeeting(id: string, data: UpdateGeneralMeetingInput) {
    return this.request<GeneralMeeting>('PATCH', `/api/governance/${id}`, data);
  }
  publishMeetingNotice(id: string) {
    return this.request<GeneralMeeting>('POST', `/api/governance/${id}/publish-notice`);
  }
  addMeetingResolution(meetingId: string, data: CreateMeetingResolutionInput) {
    return this.request<MeetingResolution>(
      'POST',
      `/api/governance/${meetingId}/resolutions`,
      data,
    );
  }
  submitMeetingProxy(meetingId: string, data: SubmitMeetingProxyInput) {
    return this.request<MeetingProxy>('POST', `/api/governance/${meetingId}/proxies`, data);
  }
  openResolutionVoting(resolutionId: string, data: OpenResolutionVotingInput = {}) {
    return this.request<MeetingResolution>(
      'POST',
      `/api/governance/resolutions/${resolutionId}/open-voting`,
      data,
    );
  }
  closeResolutionVoting(resolutionId: string) {
    return this.request<MeetingResolution>(
      'POST',
      `/api/governance/resolutions/${resolutionId}/close-voting`,
    );
  }
  castResolutionVote(resolutionId: string, data: CastResolutionVoteInput) {
    return this.request<PollMyVote[]>(
      'POST',
      `/api/governance/resolutions/${resolutionId}/vote`,
      data,
    );
  }

  // Platform console (super-admin) -----------------------------------
  listPlatformCondos(params: { search?: string } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)] as [string, string]),
    ).toString();
    return this.request<PlatformCondoSummary[]>(
      'GET',
      `/api/platform/condos${query ? `?${query}` : ''}`,
    );
  }
  platformCondoSummary(condoId: string) {
    return this.request<PlatformCondoDetail>('GET', `/api/platform/condos/${condoId}/summary`);
  }

  // Lost & found -----------------------------------------------------
  lostFoundForCondo(
    condoId: string,
    params: {
      kind?: string;
      status?: string;
      openOnly?: boolean;
      manage?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)] as [string, string]),
    ).toString();
    return this.request<{ items: LostFoundPost[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/lost-found/condo/${condoId}${query ? `?${query}` : ''}`,
    );
  }
  myLostFoundPosts(
    params: { kind?: string; status?: string; limit?: number; offset?: number } = {},
  ) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)] as [string, string]),
    ).toString();
    return this.request<{ items: LostFoundPost[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/lost-found/mine${query ? `?${query}` : ''}`,
    );
  }
  lostFoundPost(id: string) {
    return this.request<LostFoundPost>('GET', `/api/lost-found/${id}`);
  }
  createLostFoundPost(input: CreateLostFoundPostInput) {
    return this.request<LostFoundPost>('POST', '/api/lost-found', input);
  }
  resolveLostFoundPost(id: string) {
    return this.request<LostFoundPost>('POST', `/api/lost-found/${id}/resolve`);
  }
  removeLostFoundPost(id: string) {
    return this.request<LostFoundPost>('POST', `/api/lost-found/${id}/remove`);
  }
  moderateRemoveLostFoundPost(id: string) {
    return this.request<LostFoundPost>('POST', `/api/lost-found/${id}/moderate-remove`);
  }

  // Procurement / vendor bills --------------------------------------
  vendorsForCondo(
    condoId: string,
    params: { activeOnly?: boolean; limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.activeOnly) qs.set('activeOnly', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ items: Vendor[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/procurement/vendors/condo/${condoId}${suffix}`,
    );
  }
  vendor(id: string) {
    return this.request<Vendor>('GET', `/api/procurement/vendors/${id}`);
  }
  createVendor(input: CreateVendorInput) {
    return this.request<Vendor>('POST', '/api/procurement/vendors', input);
  }
  updateVendor(id: string, input: UpdateVendorInput) {
    return this.request<Vendor>('PATCH', `/api/procurement/vendors/${id}`, input);
  }
  vendorBillsForCondo(
    condoId: string,
    params: {
      status?: string;
      fund?: string;
      vendorId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ items: VendorBill[]; total: number; limit: number; offset: number }>(
      'GET',
      `/api/procurement/bills/condo/${condoId}${suffix}`,
    );
  }
  vendorBill(id: string) {
    return this.request<VendorBill>('GET', `/api/procurement/bills/${id}`);
  }
  createVendorBill(input: CreateVendorBillInput) {
    return this.request<VendorBill>('POST', '/api/procurement/bills', input);
  }
  updateVendorBill(id: string, input: UpdateVendorBillInput) {
    return this.request<VendorBill>('PATCH', `/api/procurement/bills/${id}`, input);
  }
  approveVendorBill(id: string) {
    return this.request<VendorBill>('POST', `/api/procurement/bills/${id}/approve`);
  }
  payVendorBill(id: string) {
    return this.request<VendorBill>('POST', `/api/procurement/bills/${id}/pay`);
  }
  voidVendorBill(id: string) {
    return this.request<VendorBill>('POST', `/api/procurement/bills/${id}/void`);
  }
  downloadVendorSpendCsv(condoId: string, params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.downloadBillingBlob(
      `/api/procurement/bills/condo/${condoId}/spend-by-fund.csv${suffix}`,
      'text/csv',
    );
  }

  // Audit / transparency --------------------------------------------
  myActivity(params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/api/audit/me/activity?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  whoViewedMe(params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/api/audit/me/who-viewed?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }

  // Owner empowerment -----------------------------------------------
  /** Revoke a delegated role grant. Instantly kills all sessions of the affected user. */
  revokeRoleAssignment(roleAssignmentId: string) {
    return this.request<void>('DELETE', `/api/auth/role-assignments/${roleAssignmentId}`);
  }
  delegatedAccess() {
    return this.request<
      Array<{
        id: string;
        roleId: string;
        unitId: string | null;
        expiresAt: string | null;
        createdAt: string;
        user: { id: string; name: string; email: string };
      }>
    >('GET', '/api/owner/delegated-access');
  }
  listSessions() {
    return this.request<AuthSession[]>('GET', '/api/auth/sessions');
  }
  revokeSession(sessionId: string) {
    return this.request<void>('DELETE', `/api/auth/sessions/${sessionId}`);
  }

  // Threads ----------------------------------------------------------
  listThreads(params: ListThreadsParams = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    return this.request<{ items: ThreadSummary[]; total: number }>(
      'GET',
      `/api/threads?${qs.toString()}`,
    );
  }
  thread(id: string) {
    return this.request<ThreadDetail>('GET', `/api/threads/${id}`);
  }
  createThread(input: CreateThreadBody) {
    return this.request<ThreadSummary>('POST', '/api/threads', input);
  }
  postThreadMessage(
    id: string,
    body: { body: string; internalNote?: boolean; attachmentIds?: string[] },
  ) {
    return this.request<ThreadMessageItem>('POST', `/api/threads/${id}/messages`, body);
  }
  updateThread(
    id: string,
    body: {
      priority?: ThreadPriority;
      category?: ThreadCategory;
      status?: ThreadStatus;
      assignedToUserId?: string;
    },
  ) {
    return this.request<ThreadSummary>('PATCH', `/api/threads/${id}`, body);
  }
  proposeThreadResolution(id: string, body: { note?: string; messageId?: string } = {}) {
    return this.request<ThreadSummary>('POST', `/api/threads/${id}/propose-resolution`, body);
  }
  confirmThreadResolution(
    id: string,
    body: { confirmed: boolean; rejectReason?: string; rejectExpectation?: string },
  ) {
    return this.request<ThreadSummary>('POST', `/api/threads/${id}/confirm-resolution`, body);
  }
  requestThreadResident(id: string, body: { body?: string } = {}) {
    return this.request<ThreadSummary>('POST', `/api/threads/${id}/request-resident`, body);
  }
  markThreadRead(id: string) {
    return this.request<void>('POST', `/api/threads/${id}/read`);
  }
  appealThread(id: string, body: { reason: string }) {
    return this.request<ThreadSummary>('POST', `/api/threads/${id}/appeal`, body);
  }
  closeAbusiveThread(id: string, body: { reason: string }) {
    return this.request<ThreadSummary>('POST', `/api/threads/${id}/close-abusive`, body);
  }
  async exportThreadPdf(id: string): Promise<Blob> {
    const headers: Record<string, string> = { Accept: 'application/pdf' };
    const token = await this.cfg.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const condoId = await this.cfg.getActiveCondoId?.();
    if (condoId) headers['x-condo-id'] = condoId;
    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const res = await fetchImpl(`${this.cfg.baseUrl}/api/threads/${id}/export.pdf`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* ignore */
      }
      const message =
        (parsed as { message?: string } | null)?.message ?? `HTTP ${res.status} ${res.statusText}`;
      throw new ApiError(res.status, parsed, message);
    }
    return res.blob();
  }

  // SLA / helpdesk settings -----------------------------------------
  slaSettings(condoId: string) {
    return this.request<SlaSettingsResponse>('GET', `/api/sla/condo/${condoId}`);
  }
  updateSlaSettings(
    condoId: string,
    body: {
      policies: Array<{ priority: ThreadPriority; resolutionMins: number }>;
      resolutionConfirmationGraceDays?: number;
      riskyAcknowledged?: boolean;
      rationale?: string;
    },
  ) {
    return this.request<{
      ok: boolean;
      auditId: string;
      announcementId: string | null;
      riskySave: boolean;
    }>('PUT', `/api/sla/condo/${condoId}`, body);
  }
  slaAudit(condoId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/api/sla/condo/${condoId}/audit?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  updateAutoAssignment(
    condoId: string,
    body: {
      generalTriagePool: string[];
      categoryPools: Array<{ category: ThreadCategory; userIds: string[] }>;
      seniorStaffPool: string[];
    },
  ) {
    return this.request<{ ok: boolean }>('PUT', `/api/sla/condo/${condoId}/auto-assignment`, body);
  }
  updateMlPriority(condoId: string, body: { enabled: boolean }) {
    return this.request<{ ok: boolean; mlPriority: MlPriorityStats }>(
      'PUT',
      `/api/sla/condo/${condoId}/ml-priority`,
      body,
    );
  }
  updateMlAssignment(condoId: string, body: { enabled: boolean }) {
    return this.request<{ ok: boolean; mlAssignment: MlAssignmentStats }>(
      'PUT',
      `/api/sla/condo/${condoId}/ml-assignment`,
      body,
    );
  }

  // Notifications ----------------------------------------------------
  listNotifications(params: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    if (params.unreadOnly) qs.set('unreadOnly', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<NotificationListResponse>('GET', `/api/notifications${suffix}`);
  }
  markNotificationsRead(ids: string[]) {
    return this.request<void>('PATCH', '/api/notifications/read', { ids });
  }
  registerPushToken(body: {
    kind: 'EXPO' | 'WEB';
    token: string;
    deviceInfo?: Record<string, unknown>;
  }) {
    return this.request<{ id: string }>('POST', '/api/notifications/push-tokens', body);
  }

  // User preferences (E1/E5) ----------------------------------------
  preferences() {
    return this.request<UserPreferences>('GET', '/api/auth/preferences');
  }
  updatePreferences(
    body: Partial<UserPreferences> & { quietHours?: Partial<UserPreferences['quietHours']> },
  ) {
    return this.request<UserPreferences>('PATCH', '/api/auth/preferences', body);
  }

  // FAQ --------------------------------------------------------------
  faqArticles(condoId: string, params: { q?: string; categoryId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    return this.request<{ items: FaqArticleItem[]; total: number }>(
      'GET',
      `/api/faq/condo/${condoId}?${qs.toString()}`,
    );
  }
  faqCategories(condoId: string) {
    return this.request<FaqCategoryItem[]>('GET', `/api/faq/condo/${condoId}/categories`);
  }
  faqManageList(condoId: string, params: { categoryId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    return this.request<{ items: FaqArticleItem[]; total: number }>(
      'GET',
      `/api/faq/condo/${condoId}/manage?${qs.toString()}`,
    );
  }
  faqArticle(id: string) {
    return this.request<FaqArticleItem>('GET', `/api/faq/articles/${id}`);
  }
  faqHelpful(id: string) {
    return this.request<FaqArticleItem>('POST', `/api/faq/articles/${id}/helpful`);
  }
  faqDeflectMatch(body: { condoId: string; subject: string; body: string }) {
    return this.request<FaqDeflectMatch>('POST', '/api/faq/deflect-match', body);
  }
  createFaqArticle(body: {
    condoId: string;
    categoryId?: string;
    question: string;
    answer: string;
    tags?: string[];
    published?: boolean;
    pinned?: boolean;
  }) {
    return this.request<FaqArticleItem>('POST', '/api/faq/articles', body);
  }
  updateFaqArticle(
    id: string,
    body: Partial<{
      categoryId: string;
      question: string;
      answer: string;
      tags: string[];
      published: boolean;
      pinned: boolean;
    }>,
  ) {
    return this.request<FaqArticleItem>('PATCH', `/api/faq/articles/${id}`, body);
  }
  deleteFaqArticle(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/faq/articles/${id}`);
  }
  createFaqCategory(body: { condoId: string; name: string; position?: number }) {
    return this.request<FaqCategoryItem>('POST', '/api/faq/categories', body);
  }
  updateFaqCategory(id: string, body: { name?: string; position?: number }) {
    return this.request<FaqCategoryItem>('PATCH', `/api/faq/categories/${id}`, body);
  }
  deleteFaqCategory(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/faq/categories/${id}`);
  }

  // Handover: unit types & defect taxonomy --------------------------
  unitTypes(condoId: string) {
    return this.request<UnitType[]>('GET', `/api/condos/${condoId}/unit-types`);
  }
  createUnitType(body: CreateUnitTypeInput) {
    return this.request<UnitType>('POST', '/api/unit-types', body);
  }
  updateUnitType(id: string, body: UpdateUnitTypeInput) {
    return this.request<UnitType>('PATCH', `/api/unit-types/${id}`, body);
  }
  deleteUnitType(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/unit-types/${id}`);
  }
  addUnitTypeSpace(unitTypeId: string, body: CreateUnitTypeSpaceInput) {
    return this.request<unknown>('POST', `/api/unit-types/${unitTypeId}/spaces`, body);
  }
  updateUnitTypeSpace(id: string, body: UpdateUnitTypeSpaceInput) {
    return this.request<unknown>('PATCH', `/api/unit-type-spaces/${id}`, body);
  }
  deleteUnitTypeSpace(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/unit-type-spaces/${id}`);
  }
  defectTaxonomy(condoId: string) {
    return this.request<DefectSpaceTypeTree[]>('GET', `/api/condos/${condoId}/defect-taxonomy`);
  }
  createDefectSpaceType(body: CreateDefectSpaceTypeInput) {
    return this.request<unknown>('POST', '/api/defect-space-types', body);
  }
  updateDefectSpaceType(id: string, body: UpdateDefectSpaceTypeInput) {
    return this.request<unknown>('PATCH', `/api/defect-space-types/${id}`, body);
  }
  deleteDefectSpaceType(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/defect-space-types/${id}`);
  }
  createDefectElement(body: CreateDefectElementInput) {
    return this.request<unknown>('POST', '/api/defect-elements', body);
  }
  updateDefectElement(id: string, body: UpdateDefectElementInput) {
    return this.request<unknown>('PATCH', `/api/defect-elements/${id}`, body);
  }
  deleteDefectElement(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/defect-elements/${id}`);
  }
  createDefectIssue(body: CreateDefectIssueInput) {
    return this.request<unknown>('POST', '/api/defect-issues', body);
  }
  updateDefectIssue(id: string, body: UpdateDefectIssueInput) {
    return this.request<unknown>('PATCH', `/api/defect-issues/${id}`, body);
  }
  deleteDefectIssue(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/defect-issues/${id}`);
  }
  setUnitType(condoId: string, unitId: string, unitTypeId: string | null) {
    return this.request<unknown>('PATCH', `/api/condos/${condoId}/units/${unitId}`, {
      unitTypeId,
    });
  }
  unitHandoverTemplate(unitId: string) {
    return this.request<HandoverTemplate>('GET', `/api/units/${unitId}/handover-template`);
  }

  // Handover reports -------------------------------------------------
  createHandoverReport(input: CreateHandoverReportInput) {
    return this.request<DefectReportSummary>('POST', '/api/defects/reports', input);
  }
  defectReportsForCondo(condoId: string) {
    return this.request<DefectReportSummary[]>('GET', `/api/defects/reports/condo/${condoId}`);
  }
  defectReportsForUnit(unitId: string) {
    return this.request<DefectReportSummary[]>('GET', `/api/defects/reports/unit/${unitId}`);
  }
  defectReport(id: string) {
    return this.request<DefectReportDetail>('GET', `/api/defects/reports/${id}`);
  }
  bulkUpdateReportItems(id: string, body: BulkUpdateReportItemsInput) {
    return this.request<{ updated: number }>('PATCH', `/api/defects/reports/${id}/items`, body);
  }
  /** Download a handover report as a contractor PDF (management only). */
  async exportDefectReportPdf(id: string): Promise<Blob> {
    const headers: Record<string, string> = { Accept: 'application/pdf' };
    const token = await this.cfg.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const condoId = await this.cfg.getActiveCondoId?.();
    if (condoId) headers['x-condo-id'] = condoId;
    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const res = await fetchImpl(`${this.cfg.baseUrl}/api/defects/reports/${id}/export.pdf`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* ignore */
      }
      const message =
        (parsed as { message?: string } | null)?.message ?? `HTTP ${res.status} ${res.statusText}`;
      throw new ApiError(res.status, parsed, message);
    }
    return res.blob();
  }

  // Storage ----------------------------------------------------------
  /**
   * Legacy presigned PUT flow — still used by the visitor plate-photo capture.
   * Prefer `uploadAttachment` (multipart, server-optimized) for new features.
   */
  presignAttachment(body: { contentType: string; fileName: string; size?: number }) {
    return this.request<{
      url: string;
      key: string;
      bucket: string;
      attachmentId: string;
      expiresIn: number;
    }>('POST', '/api/attachments/presign', body);
  }

  /**
   * Multipart upload (server downscales/optimizes + generates a thumbnail).
   * Uses XHR so callers get upload progress and can abort in-flight requests.
   */
  uploadFile(
    form: FormData,
    opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
  ): Promise<UploadResponse> {
    return new Promise<UploadResponse>((resolve, reject) => {
      void (async () => {
        const token = await this.cfg.getAccessToken?.();
        const sessionId = await this.cfg.getSessionId?.();
        const condoId = await this.cfg.getActiveCondoId?.();

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${this.cfg.baseUrl}/api/uploads`);
        xhr.withCredentials = true;
        xhr.responseType = 'text';
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (sessionId) xhr.setRequestHeader('x-session-id', sessionId);
        if (condoId) xhr.setRequestHeader('x-condo-id', condoId);

        if (opts.onProgress && xhr.upload) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
          };
        }
        xhr.onload = () => {
          if (xhr.status === 401) void this.cfg.onUnauthorized?.();
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(xhr.responseText) as
                | ApiResponse<UploadResponse>
                | UploadResponse;
              resolve(((parsed as ApiResponse<UploadResponse>).data ?? parsed) as UploadResponse);
            } catch {
              reject(new ApiError(xhr.status, null, 'Invalid upload response'));
            }
          } else {
            let parsed: unknown = null;
            try {
              parsed = JSON.parse(xhr.responseText);
            } catch {
              /* ignore */
            }
            const message =
              (parsed as { message?: string } | null)?.message ?? `Upload failed (${xhr.status})`;
            reject(new ApiError(xhr.status, parsed, message));
          }
        };
        xhr.onerror = () => reject(new ApiError(0, null, 'Network error during upload'));
        if (opts.signal) {
          if (opts.signal.aborted) {
            xhr.abort();
            reject(new DOMException('Upload aborted', 'AbortError'));
            return;
          }
          opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
          xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
        }
        xhr.send(form);
      })();
    });
  }

  /** Absolute URL for the full optimized image (auth header required). */
  attachmentRawUrl(id: string): string {
    return `${this.cfg.baseUrl}/api/attachments/${id}/raw`;
  }
  /** Absolute URL for the thumbnail derivative (auth header required). */
  attachmentThumbUrl(id: string): string {
    return `${this.cfg.baseUrl}/api/attachments/${id}/thumb`;
  }
  /**
   * Image source descriptor for native image components (expo-image), with the
   * auth header pre-resolved so the component can stream + cache it lazily.
   */
  async attachmentImageSource(
    id: string,
    variant: 'raw' | 'thumb' = 'thumb',
  ): Promise<{ uri: string; headers: Record<string, string> }> {
    const token = await this.cfg.getAccessToken?.();
    const condoId = await this.cfg.getActiveCondoId?.();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (condoId) headers['x-condo-id'] = condoId;
    const uri = variant === 'raw' ? this.attachmentRawUrl(id) : this.attachmentThumbUrl(id);
    return { uri, headers };
  }
  /** Fetch attachment bytes as a Blob (web: wrap in an object URL for <img>). */
  async fetchAttachmentBlob(id: string, variant: 'raw' | 'thumb' = 'thumb'): Promise<Blob> {
    const token = await this.cfg.getAccessToken?.();
    const condoId = await this.cfg.getActiveCondoId?.();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (condoId) headers['x-condo-id'] = condoId;
    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const url = variant === 'raw' ? this.attachmentRawUrl(id) : this.attachmentThumbUrl(id);
    const res = await fetchImpl(url, { headers, credentials: 'include' });
    if (!res.ok) throw new ApiError(res.status, null, `Failed to load attachment (${res.status})`);
    return res.blob();
  }
}

export function createApiClient(cfg: ApiClientConfig): ApiClient {
  return new ApiClient(cfg);
}

/**
 * Source for an upload. Provide either a web `file` (`File`/`Blob`) or a React
 * Native `{ uri, name, type }` descriptor. The bytes are streamed to the API
 * (`POST /api/uploads`), which optimizes the image + generates a thumbnail.
 */
export interface UploadSource {
  fileName: string;
  contentType: string;
  /** Web: the File/Blob to upload. */
  file?: Blob;
  /** React Native: local asset/file uri. */
  uri?: string;
  /** Local preview to carry through to the UI (object url / asset uri). */
  previewUrl?: string;
}

/**
 * Centralized cross-platform upload: builds the right FormData for web vs.
 * native and posts it via {@link ApiClient.uploadFile} (progress + abort).
 * Returns the attachment metadata to attach to a thread message, defect, etc.
 */
export async function uploadAttachment(
  api: ApiClient,
  source: UploadSource,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedAttachment> {
  const form = new FormData();
  // The 3-arg `append` overload exists in the DOM lib but not in the React
  // Native typings, so cast to a loose signature that works on both platforms.
  const append = form.append.bind(form) as (
    name: string,
    value: unknown,
    fileName?: string,
  ) => void;
  if (source.file) {
    append('file', source.file, source.fileName);
  } else if (source.uri) {
    // React Native FormData accepts this {uri,name,type} shape.
    append('file', { uri: source.uri, name: source.fileName, type: source.contentType });
  } else {
    throw new Error('uploadAttachment requires a file or uri');
  }

  const res: UploadResponse = await api.uploadFile(form, options);
  return {
    attachmentId: res.attachmentId,
    key: res.key,
    thumbnailKey: res.thumbnailKey,
    mimeType: res.mimeType,
    size: res.size,
    width: res.width,
    height: res.height,
    previewUrl: source.previewUrl ?? source.uri,
    fileName: source.fileName,
  };
}
