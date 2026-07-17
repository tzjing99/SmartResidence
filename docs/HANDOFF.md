# SmartResidence — current project handoff

> **Canonical handoff for the next AI / human.** Read this first, then
> [`ROADMAP.md`](./ROADMAP.md), [`BACKLOG.md`](./BACKLOG.md), and
> [`LOCAL_CI.md`](./LOCAL_CI.md).
>
> **Written:** 2026-07-10 (overnight finalize + Copilot concurrency fixes)  
> **Honesty style:** ✅ done · 🟡 partial / blocked · ⬜ not done

---

## 1. Repo identity

| Item | Value |
| --- | --- |
| Local path | `C:\dev\SmartResidence` |
| GitHub | [`tzjing99/SmartResidence`](https://github.com/tzjing99/SmartResidence) |
| Default branch | `main` |
| **`main` tip** | Always run `git rev-parse origin/main` (pre-honesty-pass tip: **`0d638aa`**) |
| Handoff | `docs/HANDOFF.md` (rotated from the July 10 handoff) |
| Prior tips | **`2f77150`** honesty / de-AI marketing pass · **`0d638aa`** Docker one-command launch · **`1202dfe`** #48 tip polish · **`2d11208`** #46 concurrency · **`4338f3c`** release/`v0.3.0` |
| Latest tags | **`v0.3.0`** → `4338f3c` (release merge #45) · **`v0.2.0`** → `0773c7a` / annotated `ae98ba7` |
| Package versions | `@smartresidence/*@0.3.0` (changesets via #45) |
| Open PRs | **None** after #46–#48 (confirm with `gh pr list --state open`) |
| Hosted CI | 🟡 **GitHub Actions minutes exhausted until ~2026-08-01** — do **not** claim live CI is green |

```powershell
cd C:\dev\SmartResidence
git fetch origin --tags
git rev-parse origin/main
git describe --tags --abbrev=0
```

---

## 2. What was done (detailed)

### 2.1 Finalize / Path C merge train (#35–#44 + release)

User authorized **Path C** (local verify instead of GitHub CI). Parallel finalize agent completed:

| PR | Title | Status |
| --- | --- | --- |
| **#37** | Visitor management RBAC correction (§2.1) | ✅ Merged |
| **#44** | i18n system locale default + language picker | ✅ Merged |
| **#42** | i18n errors/toasts (billing, visitors, defects, messages) | ✅ Merged |
| **#41** | Mobile Dynamic Type / Android font scale | ✅ Merged |
| **#43** | Renovation permit QR verify + printable PDF | ✅ Merged |
| **#40** | PDPA resident-initiated account deletion | ✅ Merged |
| **#36** | AGM/EGM e-voting quorum, eligibility, ballot audit | ✅ Merged |
| **#35** | C6 trained ML assignment model (Naive Bayes artifact) | ✅ Merged |
| **#38** | Self-host Next.js web Docker image build fix | ✅ Merged |
| **#39** | SUPER_ADMIN feature flags (F2 extras) | ✅ Merged |
| **#45** | `chore/release-v0.3.0` changeset version bump | ✅ Merged · tag **`v0.3.0`** |

The full merge-train record is archived in
[`archive/2026-07/JULY11_CRITICAL_PATH.md`](./archive/2026-07/JULY11_CRITICAL_PATH.md).
The release tag is `4338f3c`; concurrency **#46** merged at `2d11208`.

### 2.2 Copilot / review concurrency fixes (#46)

Reviewer scorecard called out two real bugs (not style nits). Fixed and merged:

| Bug | Before | After | Files |
| --- | --- | --- | --- |
| **Overnight-slot race** | Count slots, then insert (TOCTOU) — concurrent holiday auto-approvals could oversell | Count + insert in **`Serializable`** `$transaction` + **P2034** retry | `apps/api/src/visitor/visitor.service.ts`, helpers in `access-code.ts` |
| **Access-code collision** | Check-then-act `uniqueAccessCode()` then insert | **Insert with code + P2002 retry** (`withUniqueAccessCodeRetry`); soft cross-entity check throws `AccessCodeConflictError` and retries | `visitor.service.ts`, `recurring-pass.service.ts`, `forms.service.ts`, `access-code.ts` |

**PR:** [#46](https://github.com/tzjing99/SmartResidence/pull/46) · commit `a2f2a0a` · merge `2d11208`

**Tests added/extended:**

- `apps/api/test/access-code-concurrency.spec.ts` — P2002 / P2034 / soft-conflict retry helpers
- `apps/api/test/visitor.service.spec.ts` — Serializable overnight create, full-slot rejection, P2002 create retry

Local verify for #46:

```text
vitest: access-code-concurrency + visitor.service + recurring-pass → 70 passed
api typecheck → pass
```

### 2.3 Path C / LOCAL_CI (honest)

- ✅ Documented in [`LOCAL_CI.md`](./LOCAL_CI.md) and July 11 docs
- ✅ Used for all Jul 7–10 merges
- 🟡 **Hosted Actions still dead** until minutes reset (~2026-08-01). Do **not** burn minutes on trivial workflow re-runs hoping to “restore CI”
- 🟡 Full `ci:test:regression` / integration may need `DATABASE_URL` + `corepack pnpm infra:up` — finalize session noted integration skipped when env missing

### 2.4 UX audit (honest)

- ✅ Substantial product surface shipped (visitor, billing core, helpdesk, governance, mobile parity, i18n, a11y lite)
- 🟡 **Not** “Airbnb-grade everywhere” — ROADMAP aspirational UX vs uneven polish across admin/resident/guard
- ✅ README + homepage marketing aligned with alpha reality (Naive Bayes + gate for helpdesk assignment; Fiuu canonical MY path / not live bank cert; self-host first; Path C until ~2026-08-01)
- 🟡 UX polish still uneven across admin/resident/guard — keep evaluating against this audit before production use

### 2.5 Worktree / `SmartResidence-pr*` cleanup

- ✅ All stale worktrees were reviewed and removed; merged PR branches and
  superseded follow-up commits were deleted locally and from GitHub.
- `C:\dev\SmartResidence` is the canonical clone and holds `main`.

---

## 3. What is NOT done (detailed)

### 3.1 Open product / engineering gaps

| Item | Status | Notes |
| --- | --- | --- |
| Hosted GitHub Actions / GHCR publish | 🟡 Blocked | Minutes until ~**2026-08-01**; Path C only |
| GitHub Release UI for **v0.3.0** | ✅ Published | Release and tag exist at `4338f3c` |
| Independent **security audit** (payments / PDPA / webhooks) | ⬜ | Needs dedicated pass — do **not** invent a full audit from this overnight |
| FPX / bank rails beyond scaffold + Fiuu policy | 🟡 | Stripe + Fiuu path documented; treat live FPX certification as unfinished |
| README / marketing oversell vs alpha reality | ✅ | Honesty pass on `docs/honesty-de-ai-pass` — see §2.4 |
| Homepage messaging review | ✅ | Hero + feature copy softened for alpha / Fiuu / Naive Bayes |
| Remaining Copilot-style concurrency elsewhere | 🟡 | Spot-check found 2 bugs; billing/facility already use Serializable in places — more audit useful |
| Async AVIF/WebP transcode experiment | 🟡 Archived | Closed PR #3 was superseded; its unique worker prototype is preserved at tag `archive/pr3-avif-transcode` |
| Full AGM/EGM beyond shipped e-voting slice | 🟡 | Quorum/eligibility/audit shipped; deeper governance polish may remain |
| Platform F2 plan/usage metrics / impersonation | ⬜ | Feature flags shipped; rest future |

### 3.2 Security (explicit)

> **Bounded security pass (2026-07-17) completed; residual risk remains — not a full third-party audit.**  
> Do not claim production-ready money posture.

**Checked / hardened this pass:**

| Target | Result |
| --- | --- |
| Gateway settle without amount | ✅ Fixed — missing `amount`/`Amount` no longer settles (sandbox may use expected amount only in development/test) |
| Unsigned sandbox settle env gate | ✅ Tightened — development/test only (not `!== production`) |
| Sandbox settle HTTP seams | ✅ Same development/test gate on DuitNow/TNG sandbox routes |
| Browser return `?next=` open redirect | ✅ Already allow-listed (`CORS_ORIGINS` + `smartresidence://`) |
| Cross-provider webhook mismatch | ✅ Already rejected (`97290fd`) |
| FPX stub settle | ✅ `verifyWebhook` returns null; FPX webhook ignored |
| Visitor gate RBAC | ✅ `assertGateOperator` is guard/SUPER_ADMIN only |
| PDPA export/delete “me” routes | ✅ Controllers use `CurrentUser` only (no target user id param) |

**Residual (honest):**

- No durable webhook event-id replay ledger beyond idempotent `SUCCEEDED` settle
- PDPA export may still include unit-scoped co-resident context (threads/invoices) by design of shared unit data
- Account deletion retains some operational history (visitors, audit FKs) — not full cryptographic erasure
- Live FPX/bank certification still unfinished

### 3.3 CI minutes / Path C

- Prefer [`LOCAL_CI.md`](./LOCAL_CI.md) gates before every merge
- After Aug 1: re-enable Actions, watch first matrix carefully, publish GHCR via `release.yml` if desired

### 3.4 External worktrees (`C:\dev\SmartResidence-*`)

No external worktrees remain. Only the canonical
`C:\dev\SmartResidence` checkout is registered.

```powershell
git -C C:\dev\SmartResidence worktree list
```

---

## 4. How to continue (commands)

### 4.1 Sync

```powershell
cd C:\dev\SmartResidence
git fetch origin --tags --prune
git checkout main
git pull origin main
git rev-parse HEAD  # compare with origin/main
```

### 4.2 Local verify (Path C)

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm --filter @smartresidence/shared-types build
corepack pnpm --filter @smartresidence/api exec prisma generate
corepack pnpm --filter @smartresidence/api typecheck
corepack pnpm --filter @smartresidence/web typecheck
corepack pnpm --filter @smartresidence/mobile typecheck
corepack pnpm --filter @smartresidence/api-client typecheck
corepack pnpm --filter @smartresidence/api exec vitest run test/access-code-concurrency.spec.ts test/visitor.service.spec.ts
```

With Docker Postgres/Redis:

```powershell
corepack pnpm infra:up
# set DATABASE_URL / REDIS_URL per docs/LOCAL_CI.md
corepack pnpm --filter @smartresidence/api exec vitest run
```

### 4.3 Self-host / Docker

```powershell
# from repo root — see docs/SELF_HOSTING.md
# compose config + build; web image fixed in #38
```

### 4.4 Mobile (no tunneling)

Corporate policy bans ngrok / `expo start --tunnel`. Use LAN only:

1. `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:4000` in `apps/mobile/.env`
2. Same Wi‑Fi; firewall allow **4000** + **8081**
3. `corepack pnpm mobile:dev` — **without** `--tunnel`

Canonical: [`apps/mobile/README.md`](../apps/mobile/README.md)

### 4.5 Suggested next priorities (post-Cursor)

1. Publish GitHub Release notes for **v0.3.0** if missing  
2. Security pass: payments webhooks, PDPA export/delete, visitor gate RBAC regression  
3. Align README/marketing with alpha reality  
4. After Aug 1: restore Actions + GHCR  
5. Keep feature work on short-lived branches and remove branches after merging

---

## 5. Known bugs / tech debt (Copilot scorecard + paths)

| Issue | Severity | Path / area | Status |
| --- | --- | --- | --- |
| Overnight slot TOCTOU | High (ops) | `apps/api/src/visitor/visitor.service.ts` `create()` | ✅ Fixed #46 |
| Access-code check-then-act | Medium | Was `uniqueAccessCode` in visitor / recurring / forms | ✅ Fixed #46 |
| No live CI safety net | High (process) | `.github/workflows/*` | 🟡 Path C until Aug 1 |
| Self-host web Docker build | High (ops) | `deploy/` / Dockerfiles | ✅ Fixed #38 |
| ML “trained” oversell | Docs | `apps/api/src/threads/ml/**`, ROADMAP C6 | 🟡 Honest in backlog; watch marketing |
| FPX stub vs production rails | Product | `apps/api/src/billing/**` | 🟡 Scaffold + Fiuu policy |
| Payments / PDPA security | High | billing + `user-account-deletion` + export | 🟡 Bounded pass 2026-07-17; residual in §3.2 |
| Facility booking races | Mitigated | `apps/api/src/facility/booking.service.ts` (already Serializable) | ✅ Pattern exists |
| Invoice period uniqueness | Mitigated | billing P2002 handling + test isolation #33 | ✅ Improved |
| Homepage copy | Process | `apps/web/src/app/page.tsx` | 🟡 Updated for v0.3.0; human review remains |

---

## 6. Scorecard snapshot (7/10 review)

| Dimension | Score | Notes |
| --- | --- | --- |
| Breadth vs effort | **9** | Billing, governance, visitors, helpdesk, safety, forms, docs, e-invoicing seam — rare for solo+AI window |
| Code quality on inspection | **6.5 → ~7.5 after #46** | Patterns solid; overnight + access-code races were real. More races may exist elsewhere |
| Test / engineering discipline | **7** | Hundreds of tests, honest ✅/🟡/⬜ docs; undermined by no live CI |
| Production-readiness / security | **5** | Alpha; Docker web fixed; concurrency edge cases partially closed; **no independent security review** |
| Documentation & product thinking | **8.5** | ROADMAP/BACKLOG unusually honest |
| **Overall** | **7/10** | Strong alpha, not mature SaaS |

**What moves this to 8.5–9 (reviewer’s words):**

1. ✅ Fix the two concurrency issues found → **done (#46)**  
2. 🟡 Restore live CI → wait for Actions minutes / Path C until then  
3. ⬜ Security pass on payments / PDPA  

Architecture underneath is already there; the gap is verification under load + money/PDPA trust.

---

## 7. File map (key docs)

| Doc | Role |
| --- | --- |
| [`docs/README.md`](./README.md) | Documentation index |
| [`docs/HANDOFF.md`](./HANDOFF.md) | **This file** — canonical next-AI handoff |
| [`docs/archive/2026-07/`](./archive/2026-07/) | Historical July release plans and runbooks |
| [`docs/LOCAL_CI.md`](./LOCAL_CI.md) | Exact local commands mirroring CI |
| [`docs/ROADMAP.md`](./ROADMAP.md) | Phased product plan (source of truth for “shipped”) |
| [`docs/BACKLOG.md`](./BACKLOG.md) | Defects / deferred / completed ledger |
| [`docs/SELF_HOSTING.md`](./SELF_HOSTING.md) | Self-host / compose |
| [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) | Deploy notes |
| [`docs/BUSINESS_MODEL.md`](./BUSINESS_MODEL.md) | Business + homepage messaging source |
| [`docs/testing.md`](./testing.md) | Test strategy |
| [`apps/mobile/README.md`](../apps/mobile/README.md) | Mobile LAN-only (no tunnel) |

---

## 8. Wake-up summary (one screen)

| Item | Value |
| --- | --- |
| PRs merged (finalize) | **#35–#44** + release **#45** |
| Concurrency | ✅ **#46** → `a2f2a0a` / merge `2d11208` |
| Handoff | ✅ `docs/HANDOFF.md` |
| Tag | **`v0.3.0`** on `4338f3c` |
| Blockers | Actions minutes until Aug 1 · payments/PDPA security audit |
| Do next | Pull `main`, Path C verify, security pass |

```powershell
git pull origin main
git log -1 --oneline
git rev-parse origin/main
# compare local HEAD with origin/main
```
