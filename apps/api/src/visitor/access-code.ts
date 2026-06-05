import { randomInt } from 'node:crypto';

/** Crockford-style alphabet — excludes 0/O, 1/I/L for readability at the gate. */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateAccessCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
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
