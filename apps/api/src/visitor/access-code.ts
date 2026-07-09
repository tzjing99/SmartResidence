import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';

/** Crockford-style alphabet — excludes 0/O, 1/I/L for readability at the gate. */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Default attempts when insert races on `@@unique([condoId, accessCode])`. */
export const ACCESS_CODE_ALLOCATION_ATTEMPTS = 8;

/** Serializable overnight-slot allocation may abort under contention — retry a few times. */
export const SERIALIZABLE_TX_ATTEMPTS = 5;

export function generateAccessCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}

/** True when Postgres/Prisma rejected an insert due to a unique constraint (e.g. access code). */
export function isPrismaUniqueConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * True when a Serializable transaction was aborted due to a concurrent write
 * (Postgres SQLSTATE 40001 → Prisma P2034).
 */
export function isPrismaSerializationFailure(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
}

/** Soft cross-entity collision (visitor / recurring / form) before insert. */
export class AccessCodeConflictError extends Error {
  readonly code = 'ACCESS_CODE_CONFLICT' as const;
  constructor(message = 'Access code already in use') {
    super(message);
    this.name = 'AccessCodeConflictError';
  }
}

export function isAccessCodeConflict(err: unknown): boolean {
  return isPrismaUniqueConflict(err) || err instanceof AccessCodeConflictError;
}

/**
 * Run `allocate(accessCode)` until it succeeds or attempts are exhausted.
 * Callers should insert with the provided code and rely on the DB unique
 * constraint — on conflict, generate a fresh code and retry (no check-then-act).
 */
export async function withUniqueAccessCodeRetry<T>(
  allocate: (accessCode: string) => Promise<T>,
  maxAttempts = ACCESS_CODE_ALLOCATION_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const accessCode = generateAccessCode();
    try {
      return await allocate(accessCode);
    } catch (err) {
      lastError = err;
      if (isAccessCodeConflict(err) && attempt < maxAttempts - 1) continue;
      throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not allocate access code — try again');
}

/** Retry a Serializable transaction that failed with P2034 under write contention. */
export async function withSerializableRetry<T>(
  run: () => Promise<T>,
  maxAttempts = SERIALIZABLE_TX_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      if (isPrismaSerializationFailure(err) && attempt < maxAttempts - 1) continue;
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Transaction failed under contention');
}

export function buildQrPayload(condoId: string, visitorId: string, accessCode: string): string {
  return `${condoId}:${visitorId}:${accessCode}`;
}

export function parseQrPayload(
  payload: string,
): { condoId: string; visitorId: string; accessCode: string } | null {
  const parts = payload.trim().split(':');
  if (parts.length !== 3) return null;
  const [condoId, visitorId, accessCode] = parts;
  if (!condoId || !visitorId || !accessCode) return null;
  return { condoId, visitorId, accessCode: accessCode.toUpperCase() };
}

/** Normalize guard/resident pass input before lookup. */
export function normalizePassInput(pass: string): string {
  const trimmed = pass.trim();
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
  if (trimmed.length <= 8 && /^[a-zA-Z0-9]+$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export function isVisitorId(pass: string): boolean {
  return UUID_RE.test(pass.trim());
}
