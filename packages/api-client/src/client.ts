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
  CreateDefectInput,
  CreateVisitorInput,
  Invoice,
  Visitor,
} from '@smartresidence/shared-types';

export interface ApiResponse<T> {
  data: T;
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
  };
  managementStaff?: Array<{ id: string; name: string; email: string | null }>;
}

export interface UserPreferences {
  emailNotifications: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
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
  attachments?: Array<{ id: string; key: string; mimeType: string }>;
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = await this.cfg.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

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
  signUp(input: { email: string; password: string; name: string }) {
    return this.request<{ accessToken: string; refreshToken: string; sessionId: string }>(
      'POST',
      '/api/auth/sign-up',
      input,
    );
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

  // Visitors ---------------------------------------------------------
  createVisitor(input: CreateVisitorInput) {
    return this.request<Visitor>('POST', '/api/visitors', input);
  }
  visitorsForUnit(unitId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: Visitor[]; total: number }>(
      'GET',
      `/api/visitors/unit/${unitId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  visitorsForCondo(
    condoId: string,
    params: { status?: string; limit?: number; offset?: number } = {},
  ) {
    return this.request<{ items: Visitor[]; total: number }>(
      'GET',
      `/api/visitors/condo/${condoId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  visitorQr(visitorId: string) {
    return this.request<{ qrCode: string; png: string }>('GET', `/api/visitors/${visitorId}/qr`);
  }
  cancelVisitor(visitorId: string) {
    return this.request<void>('DELETE', `/api/visitors/${visitorId}`);
  }
  verifyQr(qr: string) {
    return this.request<Visitor>('POST', `/api/visitors/verify/${encodeURIComponent(qr)}`);
  }
  checkInVisitor(qr: string, body: { gateLocation?: string; notes?: string } = {}) {
    return this.request('POST', `/api/visitors/check-in/${encodeURIComponent(qr)}`, body);
  }
  checkOutVisitor(qr: string) {
    return this.request('POST', `/api/visitors/check-out/${encodeURIComponent(qr)}`);
  }

  // Billing ----------------------------------------------------------
  invoicesForUnit(unitId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: Invoice[]; total: number }>(
      'GET',
      `/api/invoices/unit/${unitId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  invoice(id: string) {
    return this.request<Invoice>('GET', `/api/invoices/${id}`);
  }
  payInvoice(id: string, body: { provider: string; returnUrl?: string }) {
    return this.request<{ paymentId: string; clientSecret?: string; redirectUrl?: string }>(
      'POST',
      `/api/invoices/${id}/payments`,
      body,
    );
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

  // Announcements ----------------------------------------------------
  announcementsForCondo(condoId: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/api/announcements/condo/${condoId}?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }
  ackAnnouncement(id: string) {
    return this.request('POST', `/api/announcements/${id}/ack`);
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
    return this.request<Array<{ id: string; device: string | null; lastUsedAt: string }>>(
      'GET',
      '/api/auth/sessions',
    );
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

  // Storage ----------------------------------------------------------
  presignAttachment(body: { contentType: string; fileName: string }) {
    return this.request<{ url: string; key: string; bucket: string; attachmentId: string }>(
      'POST',
      '/api/attachments/presign',
      body,
    );
  }
}

export function createApiClient(cfg: ApiClientConfig): ApiClient {
  return new ApiClient(cfg);
}
