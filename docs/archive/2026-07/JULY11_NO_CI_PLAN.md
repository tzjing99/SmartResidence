# July 11 ship plan — no GitHub Actions (2026-07-07)

> **Situation:** GitHub Actions hosted runners are blocked until **2026-08-01** (billing cycle reset). **2000 / 2000** free minutes used; **$0** overage budget blocks paid minutes until reset. **July 11 deadline is 4 days before reset** — shipping must not depend on hosted CI.
>
> **`main` tip (2026-07-07):** `fa082ef` — Merge PR #26 (Path C merge record). Prior Path C merges: **#12**, **#20**, **#24** landed on `92e0249`.
>
> **Related:** [`JULY11_CRITICAL_PATH.md`](./JULY11_CRITICAL_PATH.md) · [`JULY11_RELEASE_CHECKLIST.md`](./JULY11_RELEASE_CHECKLIST.md) · [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)

---

## Billing reality

| Item | Value |
| --- | --- |
| Free minutes this cycle | 2000 / 2000 used |
| Overage budget | **$0** (blocks paid minutes) |
| Cycle reset | **2026-08-01** (~26 days from Jul 7) |
| July 11 deadline | **Before reset** — hosted Actions unavailable unless budget raised |
| Symptom on PRs | All CI jobs fail immediately (billing / spending limit), not code failures |

Hosted CI will resume automatically on **Aug 1** when minutes reset. Until then, every push to `main` or an open PR triggers workflows that **cannot run** on GitHub-hosted runners.

---

## Three paths (ranked for July 11)

### A) Raise Actions budget temporarily — **fastest**

Increase the GitHub billing spending limit by **~$10–20** for the rest of this cycle.

- **Pros:** Restores green CI gates on PRs immediately; no local setup; branch protection / required checks work again.
- **Cons:** Costs money; minutes still finite after overage.
- **Where:** GitHub → Settings → Billing and plans → Actions → Spending limit.

**Best when:** You need CI parity on multiple remaining merges before Jul 11 and can approve a small overage charge.

### B) Self-hosted GitHub Actions runner — **best zero-cost CI restore**

Register your dev PC as a repository (or org) runner. Workflows use local CPU; **no hosted-minute consumption**.

- **Pros:** Free compute; real CI workflow runs; useful through Aug 1 and beyond.
- **Cons:** ~30 min one-time setup; PC must be on during runs; secure the runner (private repo only).
- **Docs:** [Adding self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners)

**Best when:** $0 budget is fixed but you want automated checks without waiting for Aug 1.

### C) Local CI + manual merge — **Path C (in use)**

Run the same commands as [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) locally in a worktree; merge with `gh pr merge` after green, **without** waiting for GitHub checks.

- **Pros:** $0; already used to land **#12**, **#20**, **#24** on Jul 7.
- **Cons:** Manual; easy to skip steps; no required-check enforcement; API/regression need Docker + Postgres locally.

**Best when:** Budget stays $0, runner setup is deferred, and the operator accepts manual verification discipline.

### Recommendation (Jul 7)

1. **Continue Path C** for the one remaining feature PR (**#22**) after fixing its typecheck error.
2. **Before Jul 11 ship:** start Docker Desktop, run **api + regression** on `main` (currently skipped in Path C merges).
3. **Optional:** enable Path **B** if more churn is expected before Aug 1; use Path **A** only if you can approve ~$10–20 overage for convenience.

---

## Local CI checklist (CI parity)

From [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) header and jobs. Run from repo root (or PR worktree) after `git fetch origin && git rebase origin/main`.

### Prerequisites

```powershell
corepack pnpm install --frozen-lockfile
```

**Windows note:** If `pnpm typecheck` / `turbo` fails with *“Unable to find package manager binary”*, prefix commands with `npx --yes pnpm@9.12.0` (matches `packageManager` in root `package.json`). Example: `npx --yes pnpm@9.12.0 typecheck`.

**Database jobs** need Postgres 16 + Redis 7 (Docker):

```powershell
# From repo root — starts infra/docker Postgres + Redis
corepack pnpm infra:up
```

Set env (matches CI):

```powershell
$env:DATABASE_URL = "postgresql://smartresidence:smartresidence@localhost:5432/smartresidence_test"
$env:REDIS_URL = "redis://localhost:6379"
$env:NODE_ENV = "test"
$env:BETTER_AUTH_SECRET = "ci-test-better-auth-secret-key-0123456789abcdef"
$env:BETTER_AUTH_URL = "http://localhost:4000"
$env:BILLING_ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
```

### Commands (match CI job order)

| CI job | Local command |
| --- | --- |
| Lint (Biome) | `corepack pnpm lint` |
| Typecheck | `corepack pnpm ci:typecheck` — or manually: `npx --yes pnpm@9.12.0 --filter @smartresidence/shared-types build && npx --yes pnpm@9.12.0 --filter @smartresidence/api exec prisma generate && npx --yes pnpm@9.12.0 typecheck` |
| Test (shared-types) | `npx --yes pnpm@9.12.0 ci:test:shared-types` |
| Test (web unit) | `npx --yes pnpm@9.12.0 ci:test:web` |
| Test (API) | After `prisma migrate deploy`: `npx --yes pnpm@9.12.0 ci:test:api` |
| Test (API integration + regression) | Use DB `smartresidence_regression` or run `npx --yes pnpm@9.12.0 ci:test:regression` |
| Build | `npx --yes pnpm@9.12.0 build` |
| Playwright (web) | Seed DB, start API, then `npx --yes pnpm@9.12.0 --filter @smartresidence/web test:e2e` (see `e2e-web` job in ci.yml) |

### One-shot script (Path C minimum — no Docker)

```powershell
git fetch origin
git rebase origin/main
corepack pnpm install --frozen-lockfile
corepack pnpm lint
npx --yes pnpm@9.12.0 --filter @smartresidence/shared-types build
npx --yes pnpm@9.12.0 --filter @smartresidence/api exec prisma generate
npx --yes pnpm@9.12.0 typecheck
npx --yes pnpm@9.12.0 ci:test:shared-types
npx --yes pnpm@9.12.0 ci:test:web
npx --yes pnpm@9.12.0 build
```

Record pass/fail before merge.

---

## Local verify results (2026-07-07 AM, this session)

Environment: Windows dev PC; **Docker Desktop not running** (api/regression skipped). Worktrees rebased onto pre-merge `origin/main` (`af8e29f`) unless noted.

| PR | Branch | lint | typecheck | shared-types | web unit | build | api | regression | mergeable | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **#12** governance proxy | `feature/governance-proxy-voting` | ✅ | ✅ | ✅ | ✅ | ✅ | ⏭ skip | ⏭ skip | was MERGEABLE | **Merged** Path C Jul 7 |
| **#20** PDPA export | `feature/pdpa-user-export` | — | — | — | — | — | ⏭ skip | ⏭ skip | **CONFLICTING** at verify time | **Merged** Path C Jul 7 (conflicts resolved on branch) |
| **#24** self-host docs | `docs/selfhost-hardening` | ✅ | ✅ | ✅ | ✅ | ✅* | ⏭ skip | ⏭ skip | was MERGEABLE | **Merged** Path C Jul 7; docs-only |
| **#22** mobile a11y lite | `feature/mobile-a11y-lite` | ✅ | ❌ | ✅ | ✅ | ✅ | ⏭ skip | ⏭ skip | MERGEABLE | **`Ionicons` undefined** in `apps/mobile/app/(resident)/defects/[id].tsx:142` — fix before merge |
| **`main`** @ `fa082ef` | — | ✅ | ❌ | — | — | — | ⏭ skip | ⏭ skip | — | API typecheck: Prisma drift (`TNG`, governance fields) — run `prisma generate` / migrate after Docker up |

\*Build exit 0 on re-run; turbo may emit Windows path-length warnings on `.next/standalone` symlinks — same as CI Linux path.

Prior worker `f3366ce0` had **no verify output** in transcript at session start; results above are from this run.

---

## Merge order (remaining work)

### Completed (Path C, Jul 7)

1. **#12** — governance proxy voting + immutable results audit ✅
2. **#20** — PDPA personal data export ✅
3. **#24** — July 11 release checklist + self-host validation notes ✅

### Remaining

| Order | PR | Action |
| --- | --- | --- |
| 1 | **#22** mobile a11y lite | **Fix typecheck** → rebase onto `main` → local verify → merge **or close** (see below) |
| — | **#1** changeset-release | **Do not merge** without explicit PO approval |

### #22 — merge vs close

| Option | When |
| --- | --- |
| **Merge** | Product wants incremental mobile a11y (`icon-button`, touch targets, tab-bar labels) beyond #23 mobile UX. Fix `Ionicons` import, rebase, local green, then merge. |
| **Close** | #23 mobile UX is sufficient for Jul 11; a11y gaps are non-blocking. Document in release notes as deferred. |

**Lean:** **Close #22** if Jul 11 is tight and #23 already shipped dark mode + nav polish; **merge** only if PO marks mobile a11y as ship-blocking.

---

## Merge commands (user approval required)

**Do not run without explicit OK.** GitHub required checks will stay red until Aug 1 or Path A/B.

### #22 (after local verify green)

```powershell
gh pr checkout 22
git fetch origin && git rebase origin/main
# … run local CI checklist …
gh pr merge 22 --merge --delete-branch
```

Admin override (if branch protection blocks):

```powershell
gh pr merge 22 --merge --admin --delete-branch
```

### Already merged (reference)

```powershell
gh pr merge 12 --merge --admin --delete-branch   # done 2026-07-07
gh pr merge 20 --merge --admin --delete-branch   # done 2026-07-07
gh pr merge 24 --merge --admin --delete-branch   # done 2026-07-07
```

---

## Post-merge checklist (Jul 10–11)

1. **Fix `main` typecheck** — ensure Prisma client matches schema (`prisma generate`, migrations applied); resolve any post-merge API errors.
2. **Docker smoke** — `corepack pnpm infra:up`, then full api + regression + optional Playwright on `main`.
3. **Self-host smoke** — `deploy/docker-compose.selfhost.yml` per [`JULY11_RELEASE_CHECKLIST.md`](./JULY11_RELEASE_CHECKLIST.md).
4. **Changeset + release** — add changeset(s) on `main`; refresh **#1** only with PO OK; tag **v0.2.0**.
5. **Aug 1** — hosted Actions resume; re-enable required checks if temporarily bypassed.

---

## Open PRs snapshot (2026-07-07)

| PR | Title | Status |
| --- | --- | --- |
| [#22](https://github.com/tzjing99/SmartResidence/pull/22) | feat(mobile): accessibility lite pass | Open — typecheck fix needed |
| [#1](https://github.com/tzjing99/SmartResidence/pull/1) | chore(release): version packages | Open — PO gate |

**Closed / merged this cycle:** #12, #20, #24, #25, #26 (doc updates).

---

*Updated 2026-07-07 — local verify session + Path C merge record.*
