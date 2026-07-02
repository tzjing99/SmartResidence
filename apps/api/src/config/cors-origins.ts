const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:8081'];

/**
 * Resolve allowed CORS origins directly from `process.env` for contexts that
 * run before Nest's `ConfigModule` has parsed `.env` (e.g. `@WebSocketGateway`
 * decorator options, which are evaluated at class-definition time). In
 * production, `CORS_ORIGINS` is injected directly into `process.env` by the
 * container/orchestrator, so this is available immediately; the bundled
 * default only applies to local dev when no `.env` has been loaded yet.
 */
export function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return DEFAULT_CORS_ORIGINS;
  const parsed = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_CORS_ORIGINS;
}
