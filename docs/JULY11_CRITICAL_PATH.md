# SmartResidence — July 11, 2026 Ship-Ready Critical Path

> **Audit date:** 2026-07-06 · **Target:** ship-ready by **2026-07-11** · **Branch context:** `feature/mobile-ux` (integration branch, no open PR yet)
>
> This document is a read-only audit output. It does **not** modify application code.

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
| Visitor management RBAC correction (mgmt read-only approve) | ⚠️ §2.1 pending | **MVP trust gap** — document as known limitation |
| Dedicated TNG/Boost/GrabPay adapters | Cancelled per #16 | Close #14 |
| Statement/CSV export polish | Pending | Addressed by #7 |
| Full i18n (BM/EN/中文/Tamil) | 🟡 | Phased PRs + mobile-ux — not 100% coverage |
| Trained ML assignment (C6) | Deferred | Stub only — OK for ship |
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
