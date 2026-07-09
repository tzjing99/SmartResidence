# SmartResidence — July 11, 2026 Ship-Ready Critical Path

> **Last updated:** 2026-07-10 (FINALIZE + concurrency #46) · **Target:** ship-ready by **2026-07-11**
>
> **Status: FINALIZE COMPLETE** — backlog PRs #35–#44 + release #45 + concurrency #46 on `main`;
> tag **`v0.3.0`**. Hosted GitHub Actions remain blocked until **2026-08-01** (minutes exhausted);
> Path C local verify is the gate. Canonical next-AI handoff: [`HANDOFF_JULY10.md`](./HANDOFF_JULY10.md).

---

## Jul 10 — Copilot concurrency fix ✅

Merged [#46](https://github.com/tzjing99/SmartResidence/pull/46) (`fix/visitor-concurrency-races`):

- Overnight holiday slot allocation: **Serializable** transaction + P2034 retry
- Access codes: unique-constraint insert + **P2002** retry (visitor / recurring / form permit)
- Tests: `access-code-concurrency.spec.ts` + visitor service race cases (70 passed locally)

### `main` tip (after #46)

**`2d11208`** — Merge pull request #46. Tag **`v0.3.0`** remains on release merge **`4338f3c`** (earlier on main).

---

## Jul 10 — FINALIZE COMPLETE ✅

User authorized merge-all via Path C (local verify, no GitHub CI). All 10 backlog PRs rebased, verified, and merged in dependency order.

### `main` tip (after finalize / before #46)

**`4338f3c`** — Merge pull request #45 (`chore/release-v0.3.0`); tag **`v0.3.0`** on this commit. Docs tip briefly at **`e6cb82b`**.

### Merged this session (2026-07-10)

| PR | Branch | Local verify | Merged |
| --- | --- | --- | --- |
| **#37** | `fix/visitor-mgmt-rbac` | lint ✓ · typecheck ✓ | ✅ |
| **#44** | `feature/i18n-system-locale` | lint ✓ · typecheck ✓ · rebase conflict-free | ✅ |
| **#42** | `feature/i18n-errors-toasts` | lint ✓ · typecheck ✓ · i18n key conflicts resolved | ✅ |
| **#41** | `feature/mobile-dynamic-type` | lint ✓ · typecheck ✓ · settings conflict resolved | ✅ |
| **#43** | `feature/permit-print-qr-verify` | lint ✓ · typecheck ✓ · RBAC spec merged | ✅ |
| **#40** | `feature/pdpa-account-deletion` | lint ✓ · typecheck ✓ · locale/settings conflicts resolved | ✅ |
| **#36** | `feature/governance-agm-evoting` | lint ✓ · typecheck ✓ | ✅ |
| **#35** | `feature/c6-ml-model` | lint ✓ · typecheck ✓ · docs conflict resolved | ✅ |
| **#38** | `fix/selfhost-web-docker` | lint ✓ · typecheck ✓ | ✅ |
| **#39** | `feature/platform-f2-extras` | lint ✓ · typecheck ✓ | ✅ |
| **#45** | `chore/release-v0.3.0` | changesets version | ✅ |
| **#46** | `fix/visitor-concurrency-races` | api typecheck · 70 visitor concurrency tests | ✅ |

### Full local health gate (2026-07-10, Path C — post-merge `main`)

| Gate | Result |
| --- | --- |
| `pnpm lint` | ✅ 0 errors (100 warnings, pre-existing) |
| `pnpm -r run typecheck` | ✅ all packages |
| `ci:test:api` | ✅ **73 files / 469 tests** passed (13 skipped) |
| `ci:test:regression` | ⏭ integration suites skipped (no `DATABASE_URL` in env; Docker infra up) |
| Test fixes | ✅ `visitor.service.spec.ts` + `recurring-pass.service.spec.ts` mocks updated for `formSubmission`/`recurringPass` access-code collision checks |
| Concurrency (#46) | ✅ overnight Serializable + access-code P2002 retry |

### Release completeness

| Item | Status | Notes |
| --- | --- | --- |
| **v0.3.0 tag** | ✅ | `@smartresidence/*@0.3.0` via changesets on `chore/release-v0.3.0` |
| **Backlog PRs #35–#44** | ✅ All merged | Plus #45 release + #46 concurrency |
| **GHCR images** | ⏭ Skipped | `release.yml` blocked until Actions minutes reset Aug 1 |
| **GitHub Release page for v0.3.0** | 🟡 | Git tag exists; may still need `gh release create` |

### Known gaps (non-blocking)

- ~~Visitor management RBAC correction — ROADMAP §2.1~~ ✅ #37
- ~~i18n system locale + error toasts~~ ✅ #44, #42
- ~~Mobile Dynamic Type~~ ✅ #41
- ~~Renovation permit QR verify + PDF~~ ✅ #43
- ~~PDPA account deletion~~ ✅ #40
- ~~AGM/EGM e-voting quorum/eligibility/audit~~ ✅ #36
- ~~C6 trained ML assignment model~~ ✅ #35
- ~~Self-host Docker web image build~~ ✅ #38
- ~~SUPER_ADMIN feature flags (F2 extras)~~ ✅ #39
- ~~Overnight-slot + access-code concurrency~~ ✅ #46
- GHCR publish / hosted CI until **2026-08-01**
- Homepage marketing copy approval (§6 of release checklist)
- Independent security pass on payments / PDPA (see [`HANDOFF_JULY10.md`](./HANDOFF_JULY10.md))

### Operator next step

```powershell
git pull origin main
# tip should be 2d11208 or newer
# handoff: docs/HANDOFF_JULY10.md
```

---

## Jul 9 — Plan COMPLETE ✅

GitHub Actions still blocked until **2026-08-01**. Path C local verify used for remaining merges.

### `main` tip (after this session)

**`097cc07`** — Merge pull request #33 (`fix/regression-file-serial`).

### Shipped this session (2026-07-09)

| PR | Title | Local verify | Merged |
| --- | --- | --- | --- |
| **#28** | docs: local CI fallback (`LOCAL_CI.md`) | docs-only · rebased onto main | Y |
| **#30** | fix(api): integration DB isolation between `@requires-db` suites | *(already on main at session start)* | Y |
| **#31** | fix(api): Biome format on integration fixtures | lint ✓ · api ✓ | Y |
| **#32** | docs: mark July 11 Path C plan complete | docs-only | Y |
| **#33** | fix(test): serialize `@requires-db` suites + uniquify invoice periods | regression ✓ 11/40 | Y |

### Full local health gate (2026-07-09, Path C)

| Gate | Result |
| --- | --- |
| `pnpm lint` | ✅ 0 errors (warnings only) |
| `pnpm -r run typecheck` / `npx pnpm@9.12.0 typecheck` | ✅ all packages |
| `ci:test:shared-types` | ✅ 30 tests |
| `ci:test:web` | ✅ 40 tests |
| `ci:test:api` | ✅ **81 files / 492 tests** (pre-#33; includes integration) |
| `ci:test:regression` | ✅ **11 files / 40 tests** (post-#33, `--no-file-parallelism`) |
| Self-host `compose config` | ✅ exit 0 with `deploy/.env.example` |
| Self-host `up --build` | 🔧 web image build fixed (`fix/selfhost-web-docker`) — shared-types dist + build args |

### Release completeness

| Item | Status | Notes |
| --- | --- | --- |
| **v0.2.0 tag** | ✅ | Annotated tag + [GitHub Release](https://github.com/tzjing99/SmartResidence/releases/tag/v0.2.0) |
| **PR #1 changeset release** | ✅ Merged | `@smartresidence/*@0.2.0` |
| **GHCR images** | ⏭ Skipped | `release.yml` blocked until Actions minutes reset Aug 1 |

### Known gaps (non-blocking for Jul 11)

- ~~Visitor management RBAC correction (mgmt read-only approve) — ROADMAP §2.1~~ ✅ corrected on `fix/visitor-mgmt-rbac` (owners/tenants no longer get CASL `manage Visitor` / gate ops; management denied unit approve/reject + gate; integration coverage)
- ~~Trained ML assignment (C6) — stub only~~ ✅ lightweight Naive Bayes artifact + train script on `feature/c6-ml-model` (not deep-learning infra)
- Full AGM/EGM e-voting beyond proxy + minutes
- ~~Self-host Docker web image build failure~~ — fixed on `fix/selfhost-web-docker`
- GHCR publish / hosted CI until **2026-08-01**
- Homepage marketing copy approval (§6 of release checklist)

### Operator next step

```powershell
git pull origin main
```

---

## Jul 7 PM — Path C complete ✅

GitHub Actions blocked until **2026-08-01** ($0 budget). User authorized **Path C**: local `pnpm lint` + `pnpm typecheck` (+ API/regression when Docker/Postgres available) in place of GH CI green checks. **CI resets 2026-08-01** — re-enable full GitHub Actions matrix then.

### `main` tip (Jul 7 PM)

**`0773c7a`** — `chore(release): version packages v0.2.0` (PR #1 merged, tag `v0.2.0`)

### Shipped Jul 7 (Path C merge train complete)

| PR | Title | Local verify | Merged |
| --- | --- | --- | --- |
| **#12** | feat(governance): proxy voting + immutable results audit | lint ✓ · typecheck ✓ | Y |
| **#20** | feat(pdpa): personal data export | lint ✓ · typecheck ✓ | Y |
| **#24** | docs: July 11 release checklist + self-host validation | lint ✓ · docs-only | Y |
| **#25** | fix(mobile): typecheck on main | lint ✓ · typecheck ✓ | Y |
| **#26** | docs: Path C Jul 7 merge record | docs-only | Y |
| **#22** | feat(mobile): accessibility lite pass | lint ✓ · typecheck ✓ | Y |
| **#27** | docs: expand July 11 no-CI plan | docs-only | Y |

Jul 6 merge train (#6–#23) was already on `main` before Path C.

### Release prep (complete)

| Item | Status | Notes |
| --- | --- | --- |
| **Changeset v0.2.0** | ✅ Merged | PR #29 — `.changeset/v0.2.0-july-ship.md` |
| **PR #1** | ✅ Merged | `@smartresidence/*@0.2.0` — tag [`v0.2.0`](https://github.com/tzjing99/SmartResidence/releases/tag/v0.2.0) |
| **Self-host smoke** | Config ✅ · build ❌ | Web Docker image fails Next.js resolution; dev bring-up OK |

### Closed / deferred

| PR | Title | Disposition |
| --- | --- | --- |
| **#3** | Announcements Phase 1 + AVIF | Closed — stale |
| **#14** | TNG adapter | Superseded by #16 Fiuu policy (TNG sandbox kept) |
| **#21** | i18n phase 3 | Absorbed via #23 mobile-ux |

---

## Jul 6 end-of-day status (historical)

### `main` tip (Jul 6 EOD)

**`d9c9584`** — Merge pull request #23 (`feature/mobile-ux`)

### Merged today (Jul 6)

| PR | Title |
| --- | --- |
| **#6** | docs: sync ROADMAP and BACKLOG |
| **#7** | feat(billing): resident statement CSV and receipt downloads |
| **#8** | feat(platform): SUPER_ADMIN console F2 |
| **#9** | feat(i18n): priority nav and shell surfaces |
| **#10** | feat(governance): AGM minutes and financial snapshot |
| **#11** | feat(a11y): WCAG AA lite pass (web) |
| **#13** | feat(i18n): phase 2 page content strings |
| **#14** | feat(billing): dedicated Touch n Go adapter *(merged alongside #16 Fiuu policy — TNG sandbox kept)* |
| **#15** | feat(auth): session and device management UI |
| **#16** | docs: Fiuu e-wallet policy; cancel Boost/GrabPay adapters |
| **#17** | test: harden integration coverage (billing + visitor) |
| **#18** | test(api): phase-2 HTTP integration specs |
| **#19** | feat(api): Prometheus metrics scrape endpoint |
| **#21** | feat(i18n): phase 3 guard/auth/live screens *(commits absorbed via #23; PR closed merged on GitHub)* |
| **#23** | feat(mobile): dark mode, nav cleanup, visitor pass UX, share card + self-host docs |

**14 explicit merge commits** on `main` today plus i18n phase 3 content via #23.

### Still open

| PR | Title | Blocker |
| --- | --- | --- |
| **#12** | feat(governance): proxy voting + immutable results | CI red (lint/typecheck/web unit on latest push) — merge after green |
| **#20** | feat(pdpa): personal data export | **CONFLICTING** with `main` — rebase worktree `SmartResidence-pr20` (rebase in progress) |
| **#22** | feat(mobile): accessibility lite pass | **CONFLICTING** — largely superseded by #23; close or rebase |
| **#24** | docs: July 11 release checklist + self-host validation | MERGEABLE but head was stale vs `main`; refresh branch then merge |
| **#1** | chore(release): version packages | **Do not merge** without explicit OK (changeset bot) |
| **#3** | Announcements Phase 1 + AVIF | **CLOSED** — stale; do not merge without explicit OK |

### Jul 7 priorities

1. **#12** — Fix remaining CI on `feature/governance-proxy-voting`; merge when 8/8 green.
2. **#20** — Finish rebase onto `d9c9584`, resolve settings/i18n conflicts, merge PDPA export.
3. **#24** — Rebase `docs/selfhost-hardening` onto `main`, merge release checklist.
4. **#22** — Product call: close as duplicate of #23 mobile a11y or cherry-pick gaps only.
5. **Release prep** — Add changeset for v0.2.0; refresh #1 only with PO approval.
6. **Smoke test** — `deploy/docker-compose.selfhost.yml` boot + resident billing + visitor check-in on `main`.

### Human decisions needed

- **#1 changeset bot** and **#3 AVIF** remain blocked per sprint rules unless explicitly approved.
- **#14 vs #16** resolved in favor of **Fiuu canonical + optional TNG sandbox** (both merged).

---

## Morning audit (2026-07-06 AM — historical)

> Original pre-merge audit preserved below for context.

> **Audit date:** 2026-07-06 · **Branch context at start:** `feature/mobile-ux` (no PR yet)

---

## Executive summary

SmartResidence is **feature-rich on `main`** (v0.1 core largely shipped per `docs/ROADMAP.md`) but **release-blocked by merge train backlog**: **17 feature PRs (#6–#22)** plus **`feature/mobile-ux`** (unopened PR, ~9k LOC) must land in a deliberate order. **Two PRs have red CI** (#21 lint, #12 API unit test). **Two PRs are stale/conflicting** (#3, #1). **Product conflict:** #14 (dedicated TNG adapter) vs #16 (Fiuu-only e-wallet policy). **Self-host docs exist only on `feature/mobile-ux`** and are explicitly **draft**.

**Realistic July 11 outcome:** merge train complete on `main`, green CI, refreshed changeset/release PR, smoke-tested self-host draft — **not** full v1.0 (governance AGM, full i18n, trained ML, visitor RBAC correction remain deferred).

---

## Repository snapshot (2026-07-06)

| Item | State |
| --- | --- |
| **`main` tip** | `2db9666` — Merge PR #5 (cloud-agent e2e fix) |
| **`feature/mobile-ux` tip** | `2ada0c3` — 3 commits ahead of `main`; pushed to `origin/feature/mobile-ux` |
| **Open PRs** | 19 (#1, #3, #6–#22) |
| **Local dirty state** | `apps/web/.../announcements/[id]/page.tsx` modified; worktree clones `SmartResidence-pr11`–`pr15` untracked |
| **`feature/mobile-ux` PR** | **None opened** — must open before merge |
| **`feature/mobile-ux` CI** | No GitHub Actions runs on branch (never triggered or no recent push with workflow) |

---

## Open PR inventory & CI status

CI rollup: **green** = all required CI checks SUCCESS; **red** = any FAILURE; **pending** = IN_PROGRESS; **no checks** = empty rollup.

| PR | Branch | Title | Mergeable | CI | Notes |
| --- | --- | --- | --- | --- | --- |
| **#6** | `docs/roadmap-backlog-sync` | docs: sync ROADMAP and BACKLOG | MERGEABLE | **green** | Merge train **first** (docs-only) |
| **#7** | `feature/billing-resident-exports` | resident statement CSV + receipt downloads | MERGEABLE | **green** | Billing surface |
| **#8** | `feature/platform-console-f2` | SUPER_ADMIN console F2 | MERGEABLE | **green** | Platform admin |
| **#9** | `feature/i18n-priority-surfaces` | i18n phase 1 — nav/shell | MERGEABLE | **green** | i18n stack start |
| **#10** | `feature/governance-v06-minutes-finance` | AGM minutes + finance snapshot | MERGEABLE | **green** | **Prisma migration** — governance base |
| **#11** | `feature/a11y-wcag-lite` | WCAG AA lite — web | MERGEABLE | **green** | Web a11y |
| **#12** | `feature/governance-proxy-voting` | proxy voting + immutable results | MERGEABLE | **red** | **Stacks on #10** — `PollStatus is not defined` in unit test |
| **#13** | `feature/i18n-page-content` | i18n phase 2 — page content | MERGEABLE | **green** | Touches same locale files as #9 |
| **#14** | `feature/billing-tng-adapter` | dedicated TNG adapter | MERGEABLE | **green** | **Conflicts with #16 product policy — close or defer** |
| **#15** | `feature/session-device-management` | session/device management UI | MERGEABLE | **green** | Auth/security |
| **#16** | `docs/fiuu-ewallet-policy` | Fiuu for MY e-wallets; cancel Boost/GrabPay | MERGEABLE | **green** | Stacks on #6; **supersedes #14 intent** |
| **#17** | `test/integration-regression-hardening` | billing/visitor integration hardening | MERGEABLE | **green** | `apps/api` only |
| **#18** | `test/integration-phase2-threads-ops` | phase-2 HTTP integration specs | MERGEABLE | **green** | `apps/api` only |
| **#19** | `feature/observability-metrics` | Prometheus metrics endpoint | MERGEABLE | **green** | `apps/api` only |
| **#20** | `feature/pdpa-user-export` | PDPA personal data export | MERGEABLE | **green** | API + web + mobile |
| **#21** | `feature/i18n-phase3-guard-auth` | i18n phase 3 — guard/auth | MERGEABLE | **red** | Lint: `noNonNullAssertion` in `api-client` hooks — **superseded by `feature/mobile-ux`** |
| **#22** | `feature/mobile-a11y-lite` | mobile a11y lite pass | MERGEABLE | **green** | Overlaps `feature/mobile-ux` mobile files |
| **#3** | `cursor/cloud-agent-…` | Announcements Phase 1 + AVIF | CONFLICTING | green (stale Jun 10) | **Close** — superseded by main |
| **#1** | `changeset-release/main` | chore(release): version packages | MERGEABLE | **no checks** | Stale v0.1.0 bump — **refresh after merge train** |

### Red CI detail

- **#21 — Lint (Biome):** `packages/api-client/src/hooks/index.ts` — forbidden non-null assertions (`condoId!`) at lines ~2003, ~2017. Fix or abandon PR in favor of `feature/mobile-ux`.
- **#12 — Test (API):** `governance.service.spec.ts` — `ReferenceError: PollStatus is not defined` in test *"closes resolution voting with immutable snapshot and audit log"*. One-line import fix; blocks governance stack.

---

## `feature/mobile-ux` — integration branch (critical)

**Not in the PR list.** Contains everything in #21 plus mobile UX overhaul and self-host deliverables.

| Commit | Summary |
| --- | --- |
| `80ce517` | i18n phase 3 guard/auth (same scope as #21) |
| `28c0c9f` | Wire i18n phase 3 web + mobile |
| `2ada0c3` | Dark mode, nav cleanup, visitor pass UX, share card, **self-host docs + deploy drafts** |

**91 files, +9070 / −2848 lines** vs `main`. Key additions:

- Mobile: dark theme, modern tab bar, visitor pass cards, guard/resident screen polish
- Self-host: `docs/SELF_HOSTING.md`, `docs/DEPLOYMENT.md`, `docs/BUSINESS_MODEL.md`, `deploy/docker-compose.selfhost.yml`, `deploy/.env.example`, `deploy/README.md`
- Shared types: visitor pass share helpers + tests
- `packages/ui-mobile`: theme provider, color tokens

**Merge implication:** Close **#21** after opening `feature/mobile-ux` PR. Rebase `feature/mobile-ux` onto `main` after i18n #9 + #13 merge to resolve `common.json` conflicts. Reconcile **#22** (a11y) — either merge #22 first and rebase mobile-ux, or fold #22 into mobile-ux and close #22.

**CI gap:** No green CI run on `feature/mobile-ux` yet — **Day 1 blocker:** push/rebase and open PR; expect conflicts in locale JSON and mobile components.

---

## ROADMAP / BACKLOG — shipped vs deferred

### Shipped on `main` (MVP-grade)

Per `docs/ROADMAP.md` §3: identity/RBAC, multi-tenancy, audit, visitor two-path flow, billing core + DuitNow QR + gateways, defects, threads/FAQ/SLA (v0.2 partial), announcements, realtime notifications, polls (governance-lite), facility booking, parcels, forms, documents vault, setup wizard, safety/SOS, MyInvois, WhatsApp, mobile resident/guard parity (X1).

### In open PRs (not yet on `main`)

Billing exports (#7), platform console (#8), i18n phases 1–3 (#9, #13, mobile-ux), governance minutes (#10) + proxy (#12), web/mobile a11y (#11, #22), session mgmt (#15), PDPA export (#20), observability (#19), integration test hardening (#17, #18), Fiuu policy docs (#16), mobile UX + self-host (# mobile-ux).

### Explicitly deferred (post-ship / not in merge train)

| Gap | ROADMAP status | July 11 impact |
| --- | --- | --- |
| Full AGM/EGM e-voting | ⬜ §4.8 | Partial via #10/#12 only |
| Visitor management RBAC correction (mgmt read-only approve) | ✅ §2.1 | Fixed: explicit resident visitor actions; management read/overnight only; gate ops guard-only |
| Dedicated TNG/Boost/GrabPay adapters | Cancelled per #16 | Close #14 |
| Statement/CSV export polish | Pending | Addressed by #7 |
| Full i18n (BM/EN/中文/Tamil) | 🟡 | Phased PRs + mobile-ux — not 100% coverage |
| Trained ML assignment (C6) | ✅ Lightweight | Persisted NB category model + `ml:train-assignment` |
| Marketplace, lost & found | ⬜ / cancelled | Out of scope |
| SUPER_ADMIN full platform | 🟡 | #8 partial F2 |
| Self-host production hardening | Draft on mobile-ux | **Draft compose not CI-wired** |

---

## Blockers to ship-ready (prioritized)

1. **Merge train execution** — 17 PRs + mobile-ux; serial merges with rebase discipline (~2–3 days if no surprises).
2. **Red CI** — #12 (trivial import fix), #21 (skip if closing for mobile-ux).
3. **Stacked governance** — #10 before #12; migration ordering.
4. **i18n collision** — #9 → #13 → mobile-ux; do not merge #21 separately.
5. **#14 vs #16** — product decision: **close #14**, merge #16.
6. **`feature/mobile-ux` no PR / no CI** — open PR Day 1; run full CI matrix.
7. **Changeset/release (#1)** — stale; regenerate after merge train with new changeset for v0.2.0 (or tag-only OSS release without npm publish if private).
8. **Self-host docs** — on mobile-ux only, marked **draft**; need smoke test of `deploy/docker-compose.selfhost.yml` before calling ship-ready.
9. **Stale PR #3** — close to reduce noise.
10. **Local WIP** — uncommitted announcements page fix; stash before rebasing mobile-ux.

---

## Recommended merge order (critical path)

```text
Phase A — docs + low-risk (parallel merge OK after #6)
  #6 → #16 (after #6) → #17, #18, #19 (any order, api-only)

Phase B — independent features (parallel after Phase A on main)
  #7, #8, #15, #20

Phase C — i18n (serial)
  #9 → #13 → feature/mobile-ux PR (close #21)

Phase D — governance (serial, migration)
  #10 → #12 (fix PollStatus import first)

Phase E — polish (after mobile-ux or rebase into it)
  #11, #22 (reconcile with mobile-ux — pick one path)

Phase F — release
  Refresh changeset → #1 or new release PR → tag v0.2.0 → smoke test
```

**Do not merge:** #3 (conflicting/stale), #14 (superseded by #16), #21 (superseded by mobile-ux).

---

## Day-by-day plan

### Day 1–2 (Jul 6–7) — Unblock & foundation

| Priority | Action | Owner / branch |
| --- | --- | --- |
| P0 | Fix #12: add missing `PollStatus` import in `governance.service.spec.ts`; re-run CI | `feature/governance-proxy-voting` |
| P0 | Close #21; open PR for `feature/mobile-ux` targeting `main`; trigger CI | `feature/mobile-ux` |
| P0 | Close #3, #14; confirm #16 policy with PO | docs/product |
| P1 | Merge #6 (docs sync) | `docs/roadmap-backlog-sync` |
| P1 | Merge #17, #18, #19 in parallel (api test-only) | test/*, `feature/observability-metrics` |
| P1 | Stash local announcements WIP; rebase mobile-ux onto post-#6 main | local |
| P2 | Merge #7, #15, #20 (independent) | respective branches |
| P2 | Merge #16 after #6 | `docs/fiuu-ewallet-policy` |

**Exit criteria:** main +6 PRs merged; #12 green; mobile-ux PR open with CI running; stale PRs closed.

### Day 3–4 (Jul 8–9) — Feature stack & integration

| Priority | Action | Owner / branch |
| --- | --- | --- |
| P0 | Merge #9 → #13 (i18n); rebase mobile-ux; fix locale conflicts | i18n branches |
| P0 | Merge #10 → #12 (governance) | governance branches |
| P0 | Merge mobile-ux PR (after i18n base) | `feature/mobile-ux` |
| P1 | Merge #8 (platform console) | `feature/platform-console-f2` |
| P1 | Merge #11 (web a11y); reconcile #22 vs mobile-ux mobile a11y | a11y branches |
| P2 | Full CI on `main` after each batch; run Playwright + integration suite | CI |
| P2 | Smoke test self-host draft: `deploy/docker-compose.selfhost.yml up --build` | deploy/ |

**Exit criteria:** merge train #6–#22 + mobile-ux complete (except closed PRs); `main` CI green; self-host compose boots API+web.

### Day 5 (Jul 10–11) — Buffer, release, ship-ready checklist

| Priority | Action |
| --- | --- |
| P0 | Add changeset(s) for merged work; refresh or replace #1; merge release PR |
| P0 | Tag `v0.2.0` (or agreed version); GitHub release notes from ROADMAP shipped list |
| P1 | Manual smoke: resident invoice pay, visitor pre-reg + guard check-in, thread + SLA, admin setup wizard |
| P1 | Document known limitations: visitor mgmt RBAC correction, draft self-host, partial i18n |
| P2 | Update ROADMAP/BACKLOG post-release (follow-on PR if #6 already merged) |
| Buffer | Fix any CI regressions from merge collisions; EAS mobile preview if needed |

**Ship-ready definition (Jul 11):**

- [ ] All intended PRs merged; #3, #14, #21 closed with rationale
- [ ] `main` CI green (lint, typecheck, unit, integration, Playwright, build)
- [ ] Release tagged; changeset/changelog current
- [ ] Self-host guide published (draft status OK if labeled)
- [ ] No P0 open defects in BACKLOG

---

## Parallel workstreams (non-conflicting)

Workstreams can run in parallel **within the same phase** if branch ownership stays separated. Rebase onto `main` before opening/updating PRs.

| Workstream | Branches | Primary paths | Conflicts with |
| --- | --- | --- | --- |
| **API tests & observability** | #17, #18, #19 | `apps/api/test/**`, `apps/api/src/health/**` | Low — merge early |
| **Billing & exports** | #7, #16 | `apps/api/src/billing/**`, resident billing UI | #14 (close) |
| **Platform admin** | #8 | `apps/web/src/app/admin/platform/**`, `apps/api/src/platform/**` | Low |
| **Auth & PDPA** | #15, #20 | `apps/api/src/auth/**`, settings UI | Low |
| **i18n** | #9, #13, mobile-ux | `**/i18n/locales/**`, `locale-provider` | **Each other** — serial |
| **Governance** | #10, #12 | `apps/api/src/governance/**`, prisma migrations | **Serial #10→#12** |
| **Mobile UX + self-host** | mobile-ux | `apps/mobile/**`, `deploy/**`, `docs/SELF_HOSTING.md` | #21, #22, i18n |
| **Web a11y** | #11 | `apps/web/**`, `packages/ui-web/**` | Low vs API streams |
| **Docs-only** | #6, #16 | `docs/**` | Merge #6 first |

---

## Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| i18n JSON merge conflicts | High | Serial merges; use merge driver or regenerate from source keys |
| mobile-ux + #22 double-touch mobile | Medium | Merge one; rebase the other or close #22 |
| Governance migrations clash | Medium | Always #10 before #12; never parallel |
| Self-host compose untested | Medium | Day 3 smoke; label draft in release notes |
| Changeset PR publishes to npm unexpectedly | Low | Verify `.changeset/config.json` access; merge release last |
| 5-day window too tight for 17 PRs | Medium | Cut #8 or #22 if behind; core = mobile-ux + i18n + billing #7 + tests |

---

## Appendix: branch topology

```text
main (2db9666)
├── docs/roadmap-backlog-sync (#6)
├── feature/billing-resident-exports (#7)
├── feature/platform-console-f2 (#8)
├── feature/i18n-priority-surfaces (#9)
├── feature/governance-v06-minutes-finance (#10)
│   └── feature/governance-proxy-voting (#12) ← stacks on #10
├── feature/a11y-wcag-lite (#11)
├── feature/i18n-page-content (#13)
├── feature/billing-tng-adapter (#14) ← CLOSE (use #16)
├── feature/session-device-management (#15)
├── docs/fiuu-ewallet-policy (#16) ← stacks on #6
├── test/integration-regression-hardening (#17)
├── test/integration-phase2-threads-ops (#18)
├── feature/observability-metrics (#19)
├── feature/pdpa-user-export (#20)
├── feature/i18n-phase3-guard-auth (#21) ← CLOSE (use mobile-ux)
├── feature/mobile-a11y-lite (#22)
└── feature/mobile-ux (NO PR) ← supersedes #21; adds self-host + dark mode
    ├── contains #21 commits (80ce517, 28c0c9f)
    └── 2ada0c3 (mobile UX + deploy/ + docs/)

Stale: changeset-release/main (#1), cursor/cloud-agent (#3)
```

---

*Generated by repo audit 2026-07-06. Update this doc as merges land.*
