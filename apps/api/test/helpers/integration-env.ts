/** Minimal env vars required to boot AppModule in integration tests (@requires-db). */
export function ensureIntegrationEnv(): boolean {
  if (!process.env.DATABASE_URL) return false;

  process.env.NODE_ENV ??= 'test';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-key-0123456789abcdef';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:4000';
  process.env.S3_ENDPOINT ??= 'http://localhost:9000';
  process.env.S3_ACCESS_KEY ??= 'test';
  process.env.S3_SECRET_KEY ??= 'test-secret';
  return true;
}

export const TEST_PASSWORD = 'Demo!2026';

export function authHeaders(token: string, condoId?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (condoId) headers['x-condo-id'] = condoId;
  return headers;
}
