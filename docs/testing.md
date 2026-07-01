# Testing guide

SmartResidence uses a layered test strategy: fast unit tests, database-backed integration and regression suites, and Playwright end-to-end tests against a seeded stack.

## Quick reference

| Layer | Location | Command | Needs |
| --- | --- | --- | --- |
| API unit | `apps/api/src/**/*.spec.ts` | `pnpm ci:test:api` (skips `@requires-db` without DB) | Node |
| API integration | `apps/api/test/integration/` | `pnpm ci:test:regression` | Postgres + Redis + `DATABASE_URL` |
| API regression | `apps/api/test/regression/` | `pnpm ci:test:regression` | Postgres + Redis + `DATABASE_URL` |
| Web unit | `apps/web/src/lib/` | `pnpm ci:test:web` | Node |
| Web E2E | `apps/web/e2e/` | `pnpm --filter @smartresidence/web test:e2e` | API + DB seeded, web dev/build |

Integration and regression specs are tagged **`@requires-db`**. They call `describe.skipIf(!process.env.DATABASE_URL)` and are skipped locally when Postgres is not configured.

## Local setup (API integration / regression)

1. Start infra: `pnpm infra:up` (Postgres, Redis, MinIO from `infra/docker/`).
2. Copy `apps/api/.env.example` → `apps/api/.env` and set `DATABASE_URL`.
3. Migrate: `pnpm db:migrate` or `pnpm --filter @smartresidence/api exec prisma migrate deploy`.
4. Run:
   - All API tests: `pnpm ci:test:api`
   - Integration + regression only: `pnpm ci:test:regression`
   - Single suite: `pnpm --filter @smartresidence/api exec vitest run test/integration/auth.integration.spec.ts`

## Local setup (Playwright E2E)

1. Complete API setup above and seed demo data: `pnpm db:seed`.
2. Start API: `pnpm api:dev` (port 4000).
3. In another terminal, from repo root:
   ```bash
   pnpm --filter @smartresidence/web test:e2e
   ```
   Playwright starts the web app (dev server locally, production build in CI). Demo credentials are in `apps/api/prisma/seed.ts` (password `Demo!2026`).

Optional: set `SMARTRESIDENCE_WEB_URL` if the web app is already running elsewhere.

## CI matrix (`.github/workflows/ci.yml`)

| Job | What runs |
| --- | --- |
| `lint` | Biome |
| `typecheck` | `pnpm ci:typecheck` |
| `shared-types-test` | shared-types unit tests |
| `web-test` | Web Vitest |
| `api-test` | All API Vitest (unit + integration + regression) with Postgres + Redis |
| `api-regression` | Integration + regression only (parallel, separate DB) |
| `build` | Monorepo build |
| `e2e-web` | Seed DB, start API, build web, Playwright (all `e2e/*.spec.ts`) |

On failure, CI uploads **Vitest HTML** (`apps/api/vitest-report`) and **Playwright HTML** (`apps/web/playwright-report`) artifacts.

## When to add which test type

**Unit** — Pure logic, adapters, PDF/string formatting, authorization rules with mocks. Fast; no DB. Example: `receipt.service.spec.ts`, `ability.factory.spec.ts`.

**Integration (`test/integration/`)** — HTTP contract against a real Nest app + Postgres: auth, role guards, content-types, route wiring. Use supertest and shared fixtures in `test/helpers/`.

**Regression (`test/regression/`)** — Business invariants that must never regress: idempotent payments, fund separation, one vote per unit, blacklist gate checks, deposit held balance. Prefer service-level calls with the test DB for speed.

**E2E (`apps/web/e2e/`)** — Critical user journeys in the browser: sign-in routing, page loads, primary CTAs visible. Rely on seeded demo condo (`acacia-heights`).

Do **not** import `@prisma/client` at the top of `@requires-db` spec files — Prisma loads `DATABASE_URL` from `.env` during module init, which bypasses the skip guard when Postgres is not running. Use dynamic imports inside `beforeAll` or string literal enum values instead.

Do **not** add tests that only assert mocks, duplicate coverage already in regression, or break without product value.

## Shared helpers

- `apps/api/test/helpers/create-test-app.ts` — bootstraps Nest like production.
- `apps/api/test/helpers/integration-fixtures.ts` — idempotent condo/users/tokens for `@requires-db` suites.
- `apps/web/e2e/helpers/auth.ts` — Playwright sign-in helper.
