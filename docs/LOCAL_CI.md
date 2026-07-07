# Local CI fallback

Use this when GitHub Actions minutes are exhausted or CI is blocked by billing.
Commands mirror [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Prerequisites

- Node.js **22+**, Corepack enabled (`corepack enable`)
- From repo root: `corepack pnpm install --frozen-lockfile`
- **Postgres 16 + Redis 7** for API integration, regression, and Playwright jobs
  - Quick start: `corepack pnpm infra:up` (see `infra/docker/docker-compose.yml`)
  - Or match CI env vars in `apps/api/.env` (see `apps/api/.env.example`)

### CI env (optional, for API tests)

```powershell
$env:NODE_ENV = "test"
$env:BETTER_AUTH_SECRET = "ci-test-better-auth-secret-key-0123456789abcdef"
$env:BETTER_AUTH_URL = "http://localhost:4000"
$env:DATABASE_URL = "postgresql://smartresidence:smartresidence@localhost:5432/smartresidence_test"
$env:REDIS_URL = "redis://localhost:6379"
$env:S3_ENDPOINT = "http://localhost:9000"
$env:S3_ACCESS_KEY = "ci-test"
$env:S3_SECRET_KEY = "ci-test-secret"
$env:BILLING_ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
```

## Fast gate (no Docker)

Run before every merge when GH CI is unavailable:

```powershell
corepack pnpm lint
corepack pnpm --filter @smartresidence/shared-types build
corepack pnpm --filter @smartresidence/api exec prisma generate
corepack pnpm --filter @smartresidence/api typecheck
corepack pnpm --filter @smartresidence/web typecheck
corepack pnpm --filter @smartresidence/mobile typecheck
corepack pnpm --filter @smartresidence/api-client typecheck
corepack pnpm --filter @smartresidence/shared-types typecheck
corepack pnpm --filter @smartresidence/ui-web typecheck
corepack pnpm --filter @smartresidence/ui-mobile typecheck
corepack pnpm --filter @smartresidence/shared-types test
corepack pnpm --filter @smartresidence/web test
corepack pnpm --filter @smartresidence/api exec vitest run --exclude test/integration/** --exclude test/regression/**
```

> **Note:** Root `pnpm typecheck` uses Turbo and may fail on Windows if `pnpm` is not on
> PATH outside Corepack. Per-package commands above are equivalent.

## Full CI parity (with Docker)

After `infra:up` and migrations:

```powershell
corepack pnpm --filter @smartresidence/api exec prisma migrate deploy
corepack pnpm ci:test:api
corepack pnpm ci:test:regression
corepack pnpm build
```

### Playwright (web e2e)

Uses a separate DB (`smartresidence_e2e`). Seed, start API, then run e2e:

```powershell
$env:DATABASE_URL = "postgresql://smartresidence:smartresidence@localhost:5432/smartresidence_e2e"
corepack pnpm --filter @smartresidence/api exec prisma migrate deploy
corepack pnpm --filter @smartresidence/api run db:seed
corepack pnpm --filter @smartresidence/api build
# Terminal 1: corepack pnpm --filter @smartresidence/api start
corepack pnpm --filter @smartresidence/web exec playwright install --with-deps chromium webkit
corepack pnpm --filter @smartresidence/web build
$env:NEXT_PUBLIC_API_URL = "http://localhost:4000"
$env:CI = "true"
corepack pnpm --filter @smartresidence/web test:e2e
```

## PR branch workflow

```powershell
git fetch origin main
git rebase origin/main
# run fast gate (and full parity if Docker is up)
```

If local checks pass but GitHub CI is red due to **billing/spending limit**, you may
merge with admin override after human review — document results in the PR comment.

## Self-hosted GitHub Actions runner

Free compute on your PC; minutes still count toward included allowance but **do not**
consume hosted-runner minutes. See
[GitHub docs: self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners).
