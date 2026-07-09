# SmartResidence — July 10 handoff (Cursor expiry)

> **Canonical handoff for the next AI / human.** Read this first, then
> [`JULY11_CRITICAL_PATH.md`](./JULY11_CRITICAL_PATH.md) and [`LOCAL_CI.md`](./LOCAL_CI.md).
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
| **`main` tip** | Always run `git rev-parse origin/main` (overnight chain ends at **`1202dfe`** #48 or newer after this polish) |
| Handoff content landed | **`85fc98e`** — Merge #47 · file `docs/HANDOFF_JULY10.md` |
| Prior tips | **`2d11208`** #46 concurrency · **`e6cb82b`** docs follow-up · **`4338f3c`** release/`v0.3.0` |
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

Recorded in [`JULY11_CRITICAL_PATH.md`](./JULY11_CRITICAL_PATH.md) (Jul 10 FINALIZE COMPLETE section). Tip after release was `4338f3c` / docs follow-up `e6cb82b`; concurrency **#46** → `2d11208`; handoff **#47** → `85fc98e`; tip-SHA polish **#48** → `1202dfe`.

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
- ⬜ Homepage / marketing copy still needs human approval ([`JULY11_RELEASE_CHECKLIST.md`](./JULY11_RELEASE_CHECKLIST.md) §6) — do not treat README/marketing as production truth
- 🟡 README / product docs can **oversell** (e.g. “trained ML” is a lightweight Naive Bayes + gate, not deep learning; FPX/e-wallet paths are adapter/scaffold + Fiuu-canonical policy, not full live bank certification)

### 2.5 Worktree / `SmartResidence-pr*` cleanup

- Many external worktrees remain under `C:\dev\SmartResidence-*` (see §3.5) — **not** fully cleaned overnight
- In-repo `SmartResidence-pr*` folders (if present) were historical PR worktrees; prefer deleting only after confirming no unique uncommitted work
- Release worktree: `C:\dev\SmartResidence-release` may still hold `main` checked out (blocks `git checkout main` in primary clone) — use `git pull` on current branch or free that worktree

---

## 3. What is NOT done (detailed)

### 3.1 Open product / engineering gaps

| Item | Status | Notes |
| --- | --- | --- |
| Hosted GitHub Actions / GHCR publish | 🟡 Blocked | Minutes until ~**2026-08-01**; Path C only |
| GitHub Release UI for **v0.3.0** | 🟡 Tag exists | `v0.2.0` has a GitHub Release page; **v0.3.0 is a git tag** — may still need `gh release create v0.3.0` |
| Independent **security audit** (payments / PDPA / webhooks) | ⬜ | Needs dedicated pass — do **not** invent a full audit from this overnight |
| FPX / bank rails beyond scaffold + Fiuu policy | 🟡 | Stripe + Fiuu path documented; treat live FPX certification as unfinished |
| README / marketing oversell vs alpha reality | 🟡 | Align copy with ROADMAP honesty |
| Homepage messaging approval | ⬜ | Checklist §6 |
| Remaining Copilot-style concurrency elsewhere | 🟡 | Spot-check found 2 bugs; billing/facility already use Serializable in places — more audit useful |
| `docs/selfhost-hardening` branch | 🟡 | Historically ahead/behind; content largely merged via #24 — branch may be stale |
| Full AGM/EGM beyond shipped e-voting slice | 🟡 | Quorum/eligibility/audit shipped; deeper governance polish may remain |
| Platform F2 plan/usage metrics / impersonation | ⬜ | Feature flags shipped; rest future |

### 3.2 Security (explicit)

> **Needs independent security pass on payments / PDPA / webhook replay / IDOR regressions.**  
> Overnight work fixed the two Copilot concurrency findings only. Do not claim production-ready money posture.

### 3.3 CI minutes / Path C

- Prefer [`LOCAL_CI.md`](./LOCAL_CI.md) gates before every merge
- After Aug 1: re-enable Actions, watch first matrix carefully, publish GHCR via `release.yml` if desired

### 3.4 External worktrees (`C:\dev\SmartResidence-*`)

Examples observed (may be stale; safe to prune after `git worktree list` + confirm clean):

`SmartResidence-release`, `SmartResidence-main-verify`, `SmartResidence-main-validate`, `SmartResidence-docs-selfhost`, `SmartResidence-docker-web`, `SmartResidence-visitor-rbac`, `SmartResidence-ml-c6`, `SmartResidence-agm-voting`, `SmartResidence-pdpa-delete`, `SmartResidence-permit-qr`, `SmartResidence-platform-f2`, `SmartResidence-i18n-*`, `SmartResidence-wt-*`, `SmartResidence-pr*`, etc.

```powershell
git -C C:\dev\SmartResidence worktree list
# Remove only when clean and unused:
# git worktree remove <path>
```

---

## 4. How to continue (commands)

### 4.1 Sync

```powershell
cd C:\dev\SmartResidence
git fetch origin --tags --prune
git checkout main   # if blocked by release worktree, pull inside that worktree or remove it
git pull origin main
git rev-parse HEAD  # expect 1202dfe or newer
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
5. Prune stale worktrees  

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
| Payments / PDPA security | High | billing + `user-account-deletion` + export | ⬜ Independent audit |
| Facility booking races | Mitigated | `apps/api/src/facility/booking.service.ts` (already Serializable) | ✅ Pattern exists |
| Invoice period uniqueness | Mitigated | billing P2002 handling + test isolation #33 | ✅ Improved |
| Homepage copy | Process | `JULY11_RELEASE_CHECKLIST.md` §6 | ⬜ |

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
| [`docs/HANDOFF_JULY10.md`](./HANDOFF_JULY10.md) | **This file** — canonical next-AI handoff |
| [`docs/JULY11_CRITICAL_PATH.md`](./JULY11_CRITICAL_PATH.md) | Ship plan + Path C merge log (Jul 7–10) |
| [`docs/JULY11_RELEASE_CHECKLIST.md`](./JULY11_RELEASE_CHECKLIST.md) | Release checklist + homepage §6 |
| [`docs/JULY11_NO_CI_PLAN.md`](./JULY11_NO_CI_PLAN.md) | Paths A/B/C when Actions dead |
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
| Handoff | ✅ **#47** `85fc98e` (+ tip polish **#48** `1202dfe`) · `docs/HANDOFF_JULY10.md` |
| Tag | **`v0.3.0`** on `4338f3c` |
| Blockers | Actions minutes until Aug 1 · security audit unpaid · marketing/README honesty · stale worktrees |
| Do next | Pull `main`, Path C verify, optional `gh release create v0.3.0`, security pass |

```powershell
git pull origin main
git log -1 --oneline
git rev-parse origin/main
# expect 1202dfe or newer
```
