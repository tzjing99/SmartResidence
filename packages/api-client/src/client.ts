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
