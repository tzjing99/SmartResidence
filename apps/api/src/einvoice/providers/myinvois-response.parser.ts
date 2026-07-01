import type { EInvoiceStatus } from '@smartresidence/shared-types';

/** Best-effort read of a nested string field from LHDN JSON responses. */
function readString(obj: unknown, ...keys: string[]): string | undefined {
  let cur: unknown = obj;
  for (const key of keys) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' && cur.length > 0 ? cur : undefined;
}

function readArray<T = unknown>(obj: unknown, key: string): T[] {
  if (!obj || typeof obj !== 'object') return [];
  const val = (obj as Record<string, unknown>)[key];
  return Array.isArray(val) ? (val as T[]) : [];
}

/** Map LHDN document / submission status strings to our persisted enum. */
export function mapMyInvoisStatus(raw: string | undefined): EInvoiceStatus {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('valid') && !s.includes('invalid')) return 'VALID';
  if (s.includes('invalid') || s.includes('reject')) return 'INVALID';
  if (s.includes('cancel')) return 'CANCELLED';
  if (s.includes('submitted') || s.includes('progress') || s.includes('pending')) return 'PENDING';
  return 'PENDING';
}

export interface ParsedSubmissionResponse {
  submissionUid?: string;
  uuid?: string;
  longId?: string;
  status: EInvoiceStatus;
  error?: string;
}

/**
 * Parse POST /documentsubmissions/ response.
 * TODO(live-validation): Confirm exact response shape once sandbox credentials are available.
 */
export function parseSubmissionResponse(body: unknown): ParsedSubmissionResponse {
  const submissionUid = readString(body, 'submissionUid');
  const accepted = readArray<Record<string, unknown>>(body, 'acceptedDocuments');
  const rejected = readArray<Record<string, unknown>>(body, 'rejectedDocuments');

  if (rejected.length > 0) {
    const first = rejected[0];
    if (!first) {
      return { submissionUid, status: 'INVALID', error: 'Rejected document with no details' };
    }
    const error =
      readString(first, 'error', 'message') ??
      readString(first, 'error', 'details', '0', 'message') ??
      JSON.stringify(first.error ?? first);
    return { submissionUid, status: 'INVALID', error };
  }

  if (accepted.length > 0) {
    const doc = accepted[0];
    if (!doc) {
      return { submissionUid, status: 'INVALID', error: 'Accepted document with no details' };
    }
    return {
      submissionUid,
      uuid: readString(doc, 'uuid'),
      longId: readString(doc, 'longId'),
      status: 'PENDING',
    };
  }

  return {
    submissionUid,
    status: submissionUid ? 'PENDING' : 'INVALID',
    error: 'Empty submission response',
  };
}

export interface ParsedSubmissionStatus {
  overallStatus?: string;
  documents: Array<{ uuid?: string; longId?: string; status?: string; error?: string }>;
}

/** Parse GET /documentsubmissions/{uid} response. */
export function parseSubmissionStatusResponse(body: unknown): ParsedSubmissionStatus {
  const overallStatus = readString(body, 'overallStatus') ?? readString(body, 'status');
  const documentSummary = readArray<Record<string, unknown>>(body, 'documentSummary');
  const documents = documentSummary.map((row) => ({
    uuid: readString(row, 'uuid'),
    longId: readString(row, 'longId'),
    status: readString(row, 'status'),
    error: readString(row, 'errorMessage') ?? readString(row, 'error', 'message'),
  }));
  return { overallStatus, documents };
}

export interface ParsedDocumentDetails {
  uuid?: string;
  longId?: string;
  status?: string;
  validationErrors?: string[];
}

/** Parse GET /documents/{uuid}/details response. */
export function parseDocumentDetailsResponse(body: unknown): ParsedDocumentDetails {
  const validationErrors = readArray<Record<string, unknown>>(body, 'validationResults')
    .map((v) => readString(v, 'error') ?? readString(v, 'message'))
    .filter((m): m is string => Boolean(m));

  return {
    uuid: readString(body, 'uuid'),
    longId: readString(body, 'longId'),
    status: readString(body, 'status'),
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
  };
}

export interface ParsedCancelResponse {
  uuid?: string;
  status: EInvoiceStatus;
  error?: string;
}

/** Parse PUT /documents/state/{uuid}/state response. */
export function parseCancelResponse(body: unknown): ParsedCancelResponse {
  const uuid = readString(body, 'uuid');
  const rawStatus = readString(body, 'status');
  const errorObj = (body as Record<string, unknown> | null)?.error;
  const error =
    readString(errorObj, 'message') ?? (typeof errorObj === 'string' ? errorObj : undefined);

  if (error) {
    return { uuid, status: 'INVALID', error };
  }

  return { uuid, status: mapMyInvoisStatus(rawStatus ?? 'cancelled') };
}

/** Extract a human-readable error from a non-2xx MyInvois API body. */
export function parseApiError(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body;
  const message =
    readString(body, 'message') ??
    readString(body, 'error', 'message') ??
    readString(body, 'error', 'details', '0', 'message');
  if (message) return message;
  try {
    return JSON.stringify(body);
  } catch {
    return fallback;
  }
}
