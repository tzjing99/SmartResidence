# SmartResidence Backlog

Tracked defects and deferred refinements not yet scheduled into a milestone; see [docs/ROADMAP.md](./ROADMAP.md) for the phased plan.

> This file is hand-maintained. Items are moved into a [docs/ROADMAP.md](./ROADMAP.md) milestone when they are scheduled.

Priority legend: **P1** (high) · **P2** (medium) · **P3** (low).

## Accessibility

| ID | Priority | Area | Description |
| --- | --- | --- | --- |
| **A1** | P2 | mobile + web | WCAG AA lite pass — tab bar labels, auth screen reader labels, 44pt touch targets, landmark headers, list row labels, IconButton for back controls. **Mobile partial done** (`feature/mobile-a11y-lite`); web partial done (`feature/a11y-wcag-lite`). |

## Recently completed

- ✅ **A1 — Mobile accessibility lite pass** — tab bar labels and roles, auth/loading screen reader support, 44pt touch targets, landmark headers, list row labels, IconButton back controls, ui-mobile Button/Field/AnimatedPressable defaults.
- ✅ **GV1 — Governance core (v0.6 partial)** — `GovernanceModule` (`apps/api/src/governance/**`): `GeneralMeeting` (AGM/EGM), notice workflow, `MeetingProxy`, `MeetingResolution` with share-weighted e-voting via linked `Poll` (For/Against/Abstain); admin `/admin/governance`, resident `/(resident)/governance`, mobile `(resident)/governance`; migration `20260702170000_governance`; e2e `governance.spec.ts`. **Remaining:** minutes publication + financial/budget transparency (see ROADMAP §4.8).
- ✅ **LF1 — Lost & found board** — `LostFoundModule` (`apps/api/src/lost-found/**`): `LostFoundPost` with kind/status + photo attachments; admin `/admin/lost-found`, resident `/(resident)/lost-found`, mobile `(resident)/lost-found`; migration `20260702160000_lost_found`; e2e `lost-found.spec.ts`.
- ✅ **F2 (partial) — Platform console basics** — `PlatformModule` + web `/admin/platform` (condo list/search, per-condo detail, setup status badges, open-condo-admin context switch) for `SUPER_ADMIN`. Full provisioning/plans/impersonation still future.
- ✅ **SEC1 — Security hardening (PR #5, merge `2db9666`)** — Helmet/CSP headers, auth rate limiting, argon2/TOTP hardening, JWT on Socket.IO, Swagger gated to non-prod, billing webhook/redirect hardening, dependency patches, and broad IDOR remediation across visitor, defects, billing, announcements, FAQ, MCP, parcels, and related controllers. See ROADMAP §4.12.
- ✅ **V5 — Visitor RBAC correction** — `ability.factory.ts` now grants management **read-only** visitor access (plus overnight-policy abilities for admins); unit-scoped approve/reject remains owner/tenant only. Covered by `ability.factory.spec.ts` ("lets management read the visitor log but not approve or reject visitors").
- ✅ **Ops batch (`6dd4f00`) + follow-on (`a4baa2a`)** — DuitNow QR + gateway UI, facility booking, parcels, forms/workflows, safety/SOS + guard patrol, first-time setup wizard (no forced redirect), delivery/e-hailing passes, documents vault, WhatsApp notifications, production MyInvois e-Invoice seam; **community marketplace cancelled** (product decision); **dedicated Boost/GrabPay e-wallet adapters cancelled** — **Fiuu (Razer)** is the canonical production path for TNG/Boost/GrabPay (see PAY1–PAY3). **Guard on-site admit kept** (see ROADMAP §2.1).
- ✅ **N1 — Real-time notifications (web toast + bell + mobile push fix)** — notification dispatch now emits an enriched `notification.created` event (title/body/data) that `realtime.gateway` forwards as `notification:new` to the recipient's `user:*` room. Web shows an in-app toast (`realtime-provider.tsx`) plus a notification bell with unread badge + dropdown (`notification-bell.tsx`) wired into `app-shell` and `admin-shell`; api-client gains `useNotifications`/`useMarkNotificationsRead` (+ `listNotifications`/`markNotificationsRead`/`registerPushToken`). Mobile push now registers via the authenticated `api.registerPushToken` (`src/lib/push.ts`, `use-push-registration.ts`, `push-navigation.ts`, `push-navigation-bridge.tsx`).
- ✅ **GP1 — Governance-lite polls (owner-verified MC voting)** — `PollsModule` (`apps/api/src/polls/**`) with active-ownership-verified voting (only unit owners may vote; ownership + condo checked at vote time); admin authoring `/admin/polls` + resident `/(resident)/polls` on web, mobile `(resident)/polls.tsx`; `packages/shared-types/src/polls.ts`; migration `20260701160000_owner_polls`. Distinct from full AGM/EGM e-voting (still future).
- ✅ **MI1 — MCP integrations (admin)** — per-condo `McpServerConnection` (`apps/api/src/integrations/**`, `mcp-client.ts`) with admin UI `/admin/settings/integrations`; `packages/shared-types/src/mcp.ts`; CASL subject `McpServer` (manage for admin, read for staff); migration `20260701180000_mcp_server_connections`.
- ✅ **V4 — Visitor blacklist + recurring passes** — `VisitorBlacklistService`/controller + `RecurringPassService`/controller + schedule (`apps/api/src/visitor/*`); `packages/shared-types/src/visitor-blacklist.ts` + `recurring-pass.ts`; web `visitor-blacklist-panel.tsx`; mobile resident `(resident)/visitors/recurring.tsx`; guard recurring-pass check-in + blacklist alerts on `scan.tsx`/`manual.tsx`; migration `20260701120000_visitor_blacklist_recurring_passes`.
- ✅ **M3 — Helpdesk priority-change reassignment + ML assignment scaffold (C6 seam)** — priority override now re-routes the assignee via `ThreadAssignmentService.assignOnPriorityChange` (URGENT → senior pool, etc.), not just SLA recompute. ML phase-2 seam now exists: `assignment-assist.provider.ts` + `composite-assignment-assist.provider.ts`, `ml/ml-assignment.service.ts` gated behind `ML_ASSIGNMENT_MIN_CLOSED_THREADS = 200` + an opt-in admin toggle on `/admin/settings/helpdesk`; deterministic rules remain the fallback (a real trained model is still future).
- ✅ **X1 — Mobile resident + guard feature parity** — new resident screens under `apps/mobile/app/(resident)/` (notifications, advance/prepaid payment in `billing.tsx`, polls, recurring passes, FAQ, delegated access) plus guard recurring-pass check-in + blacklist alerts, bringing mobile in line with web.
- ✅ **Advance maintenance payment (prepaid credit)** — resident advance/prepaid maintenance payment shipped on web (`(resident)/billing/page.tsx`) and mobile (`(resident)/billing.tsx`) via `useCreateAdvancePayment`, topping up `UnitAccount` credit auto-applied to future invoices; migration `20260630160000_resident_advance_payments`.
- ✅ **B1 — Billing v2 (deposits + accounting + self-serve gateways)** — three-phase build atop the billing core:
  - **Phase 1:** `Deposit` (renovation/delivery/etc. with refund + forfeit), auto-issued `Receipt` with an admin-configurable template (`/admin/settings/billing`) and dependency-free PDF, and a per-`UnitType` `UnitTypeFeeRate` that auto-computes maintenance + sinking-fund invoice lines in `generateRecurring`. Resident `/billing` shows deposits, credits and receipts; admin `/admin/deposits`.
  - **Phase 2:** append-only fund-tagged `LedgerEntry` + `UnitAccount` prepayment credit (advance maintenance auto-applied to invoices); reports for fund balances, collections, arrears aging and per-unit statements (`/admin/accounting`, resident statement summary).
  - **Phase 3:** per-condo `PaymentGatewayConnection` with **AES-256-GCM** envelope-encrypted secrets (`BILLING_ENCRYPTION_KEY`; never returned to clients); **Stripe** live + **Fiuu (Razer)** / **iPay88** sandbox-ready adapters (signed redirect + callback verification); condo-aware webhooks; idempotent settlement that auto-issues a receipt + writes the ledger; resident Pay-now method picker. CASL subjects `Deposit`/`Receipt`/`BillingSettings`/`Ledger`; 30 Vitest specs; typecheck + Biome green.
- ✅ **V3 — Visitor polish sprint** — guard walk-in unit search picker (web + mobile, API search by block/unit/resident); i18n hook + visitor/helpdesk/settings wiring (en/ms/zh-Hans); Windows `db:migrate` fix; admin overnight queue filters + readable summary table; mobile guard walk-in tablet layout.
- ✅ **S1 — Helpdesk & SLA settings panel** — `SlaPolicyService` API + web `/admin/settings/helpdesk` (slider UX, dynamic advisory bands, risky-save announcement, grace period, audit log, **assignee pool editor**) + mobile management screen.
- ✅ **M1 — Enhanced resolution flow** — accepted-answer, propose-resolve gate, reject why+what-wanted, grace period, auto-close, appeals, reopen badge; **D7** abusive close + **E1** email opt-in shipped in follow-on.
- ✅ **M2 — Thread auto-assignment (phase 1)** — category → pool routing, triage, recategorise reassign, repeat complainant; **F3** inbox sort, **F4** FAQ deflection, **G2** PDF export shipped in follow-on. ML (**C6**) scaffold/seam now shipped (opt-in flag + 200-thread gate + stub provider); trained model still deferred.
- ✅ **Deferred messaging polish (v0.2 follow-on)** — **F3**, **F4**, **S1** pool editor, **G2**, **D7**, **E1**, **G1** owner SLA audit page, **E5** quiet hours (web + mobile + API).
- ✅ **D2 — Helpdesk thread behavior** — resident-driven resolution model: management "proposes resolved" (new `PENDING_RESIDENT_CONFIRMATION` status + `resolutionProposedAt`/`resolutionProposedByUserId`), resident confirms/rejects, resident comments while `AWAITING_MANAGEMENT` no longer flip status, explicit "request to resident" action, and a 7-day auto-confirm fallback in the scheduled scanner.
- ✅ **H1 — Helpdesk dashboard polish** — cleaner admin inbox (columns for subject/requester/priority/status/assignee/SLA), unmistakable SLA chips (On track / At risk / Breached with time remaining), category + assignee filters, sort by SLA due, and the new D2 affordances surfaced in the thread detail + resident view.
- ✅ **D1 — Announcement rich-text rendering** — sanitized markdown rendering on web (resident + admin pages) and mobile, plus a live markdown preview in the admin composer.
- ✅ **T1 — Repo-wide lint for green CI** — `corepack pnpm lint` now exits 0 (ignored generated dirs incl. `.docusaurus`; fixed residual format/import-sort errors).
- ✅ **U1 — Page load perf (lite HSR)** — route-level `loading.tsx` shimmer skeletons, nav prefetch on hover/mount, shell retention during auth (sidebar skeletons), removed `PageFade` remount delay, `keepPreviousData` on thread lists. **Shipped:** `ce33631` (+ CI `f92d6ae`, `32cd37e`; green run `27017382927`).
- ✅ **H2 — Realtime helpdesk** — optimistic message send with rollback, Socket.IO `thread:*` events → TanStack Query cache patches, live inbox refresh, assigned-to updates on `thread:update`, shared `RealtimeProvider` (web + mobile), thread room join/leave on gateway. **Shipped:** `299531f` (+ fixes above).

## Product decisions (cancelled / won't-do)

| ID | Area | Description |
| --- | --- | --- |
| **PAY1** | billing | **Dedicated Boost adapter — cancelled.** Production JMBs use **Fiuu (Razer)** hosted checkout; no separate Boost merchant contract or adapter. |
| **PAY2** | billing | **Dedicated GrabPay adapter — cancelled.** Same as PAY1 — Fiuu covers GrabPay alongside TNG and Boost. |
| **PAY3** | billing | **Dedicated TNG adapter — optional/sandbox only.** Fiuu is the canonical production path for Touch 'n Go; a direct TNG sandbox adapter may exist for integration testing but is not required for JMB go-live. |

## Defects

| ID | Priority | Area | Description |
| --- | --- | --- | --- |
| **D1** | ✅ Done | web + mobile | Announcement rich-text rendering. Announcement bodies are authored/stored as markdown but render as literal text (e.g. `## Notice from JMB` and `**June 12, 2026**` appear raw instead of formatted). |
| **D2** | ✅ Done | api + web | Helpdesk thread behavior does not match the intended resident-driven resolution model. |

### D1 — Announcement rich-text rendering ✅ Done

Render markdown/rich text on display in **both** the web announcements pages and the mobile app, **and** provide a rich-text editor in the admin announcements composer (`apps/web/src/app/admin/announcements/page.tsx`).

- ✅ Safe, sanitized markdown renderer for display (`react-markdown` + `remark-gfm` + `rehype-sanitize` on web via a shared `<Markdown>` component; `react-native-markdown-display` on mobile).
- ✅ Markdown authoring in the admin composer (textarea + live sanitized preview pane using the same `<Markdown>` component).

Test case (the sample notice should render formatted, not raw):

```markdown
## Notice from JMB
The water utility will be performing pipe maintenance on **June 12, 2026** from **10am to 2pm**. Please store water in advance.
```

### D2 — Helpdesk thread behavior ✅ Done

Resident-driven resolution model implemented end-to-end (API + web).

- ✅ **(a) Comments while `AWAITING_MANAGEMENT`.** A resident adding comments no longer flips status — it stays `AWAITING_MANAGEMENT`.
- ✅ **(b) Resident-driven resolution.** Management can "propose resolved" (new `PENDING_RESIDENT_CONFIRMATION` status + `resolutionProposedAt` / `resolutionProposedByUserId` on `Thread`); the resident confirms (→ `RESOLVED`) or rejects/replies (→ `AWAITING_MANAGEMENT`, proposal cleared). Management can no longer resolve/close directly (blocked in the service + CASL `cannot('resolve','Thread')`). A **7-day** auto-confirm fallback (`SlaService.RESOLUTION_CONFIRMATION_WINDOW_DAYS`) closes silent proposals via the scheduled scanner, with audit + notification.
- ✅ **(c) Explicit requests to resident.** A dedicated "request to resident" action sets `AWAITING_RESIDENT`; a plain management reply keeps `AWAITING_MANAGEMENT`. The resident's reply moves it back to `AWAITING_MANAGEMENT`.

## Deferred UI polish

| ID | Priority | Area | Description |
| --- | --- | --- | --- |
| **V3** | ✅ Done | web + mobile + api | Visitor polish sprint — guard unit picker, i18n wiring, db:migrate Windows fix, admin overnight queue, mobile tablet parity. |
| **H1** | ✅ Done | web | Helpdesk dashboard polish. Pairs with D2 (same pass). |
| **H2** | ✅ Done | web + mobile + api | Realtime helpdesk — optimistic send, socket cache updates, live inbox, assigned-to badge. |

### V3 — Visitor polish sprint ✅ Done

- ✅ **Guard unit picker** — searchable by block, unit number, and resident name; web `/guard/walk-in` + mobile walk-in tab; guards granted `read Unit` in condo scope.
- ✅ **i18n** — `LocaleProvider` + `useT()`; visitor tabs, pre-reg form sections, admin visitor settings section titles, helpdesk inbox wired to en/ms/zh-Hans keys.
- ✅ **Dev ergonomics** — `db:migrate` / `db:migrate:deploy` use `corepack pnpm exec prisma generate` (fixes nested `pnpm db:generate` on Windows).
- ✅ **Admin overnight queue** — Live tab filters (overnight pending / urgent / holiday review); overnight summary table sticky header + zebra rows.
- ✅ **Mobile parity** — guard walk-in uses unit picker with tablet-centered layout.

### H1 — Helpdesk dashboard polish ✅ Done

- ✅ Cleaner inbox layout with subject / requester+unit / priority / status / assignee / SLA columns (card rows, responsive grid, framer-motion list).
- ✅ Unmistakable SLA chips via a shared `<SlaChip>`: green **On track** / amber **At risk** / red **Breached**, each showing the time remaining or overdue amount (breached/at-risk get a coloured ring to pop), exact due time in the tooltip.
- ✅ Category + assignee filters added (status/priority/SLA retained) plus **sort by SLA due**; sensible empty states; new D2 affordances surfaced (management "Propose resolved" / "Request from resident", resident "Confirm resolved / Not resolved", pending-confirmation banner) with i18n keys (en/ms/zh-Hans).

### H2 — Realtime helpdesk ✅ Done

**Status:** ✅ Done · **Area:** web + mobile + api · **Shipped:** commit `299531f` (+ CI `f92d6ae`, `32cd37e`; green run `27017382927`)

- ✅ **Optimistic send** — message bubbles appear immediately; rollback on mutation error.
- ✅ **Socket cache updates** — `RealtimeProvider` patches TanStack Query thread detail + inbox lists on `thread:message`, `thread:update`, `thread:sla`; dedupes against optimistic IDs.
- ✅ **Live inbox** — management and resident thread lists refresh without manual refetch when peers post or status/SLA changes.
- ✅ **Assigned-to badge** — assignee column and `thread:update` events keep the inbox assignee label current.
- ✅ **Gateway thread rooms** — `joinThread` / `leaveThread` on `realtime.gateway`; condo-scoped connection via shared `RealtimeProvider` (web `WebRealtimeProvider`, mobile equivalent).

## UX performance

| ID | Priority | Area | Description |
| --- | --- | --- | --- |
| **U1** | ✅ Done | web | Page load skeletons + prefetch (**lite HSR**). |

### U1 — Page load perf (lite HSR) ✅ Done

**Lite HSR** (lightweight hybrid-shell routing): keep the app chrome visible during navigation, show route-level shimmer skeletons while client bundles compile or data loads, and prefetch likely next routes so warm navigations skip the RSC round-trip — SPA-grade perceived speed without full streaming SSR.

**Status:** ✅ Done · **Area:** web · **Shipped:** commit `ce33631` (+ CI `f92d6ae`, `32cd37e`; green run `27017382927`)

- ✅ Route-level `loading.tsx` skeletons (dashboard, messages, helpdesk, settings, admin).
- ✅ Nav prefetch on hover, focus, and mount (`shell-nav`, `settings-sub-nav`).
- ✅ Shell retention during auth — sidebar/content skeletons instead of blank flash (`app-shell`, `admin-shell`).
- ✅ Removed `PageFade` remount animation delay (pass-through wrapper).
- ✅ `keepPreviousData` on thread list queries to avoid list flicker on refetch.

## Messaging & helpdesk enhancements

> **Spec status:** **decision-complete** (Rounds 1–3 locked). No open messaging questions remain.

| ID | Priority | Status | Roadmap | Description |
| --- | --- | --- | --- | --- |
| **S1** | P1 | ✅ Done (partial) | v0.2 | Helpdesk & SLA settings panel — management-only SLA policy editing (web admin + mobile management) with slider UX, advisory bands, and transparency on risky choices. |
| **M1** | P1 | ✅ Done (partial) | v0.2 | Enhanced resolution flow — refinements on top of D2 (accepted-answer UX, no propose gate, household-member confirm, unlimited appeals, configurable grace period). |
| **M2** | P2 | ✅ Done (partial) | v0.2 → v0.3 | Thread auto-assignment — deterministic rules first; ML when sufficient historical data exists. |

### S1 — Helpdesk & SLA settings panel ✅ Done (partial)

**Status:** ✅ Done (partial) · **Priority:** P1 · **Roadmap:** v0.2 · **Shipped:** commits `9fa7857`–`af7256f` (CI green)

**Built (v0.2)**

- ✅ `SlaModule` + `SlaPolicyService` / `sla-policy.controller` — CRUD for `SlaPolicy` rows, dynamic advisory bands (`sla-bands.ts`), grace period in `condo.settings.helpdesk`, audit log, risky-save → immediate transparency announcement.
- ✅ Web admin `/admin/settings/helpdesk` — per-priority resolution sliders (40% first-response derivation), band chips, risky-save modal + optional rationale, SLA audit log panel.
- ✅ Mobile management `helpdesk-settings` screen — same SLA + grace controls for `MANAGEMENT_ADMIN`.
- ✅ `SlaService` reads configurable grace period per condo; open-thread due dates recalculated on policy change.

**Deferred**

- None (pool editor UI shipped in follow-on pass).

A **management-only** settings panel on **web admin and mobile management** (v0.2) for configuring condo-wide helpdesk parameters. SLA policy editing is **not** available to residents, tenants, or `UNIT_OWNER` (owners get **read-only** SLA audit log access per **G1**). Unit notification preferences (incl. quiet hours per **E5**) live in a separate resident-profile surface.

**Who can access**

| Role | Scope | Example parameters |
| --- | --- | --- |
| **MANAGEMENT_ADMIN** | Condo-wide | SLA resolution windows per priority (`SlaPolicy` rows; first-response auto-derived at 40%), resolution-confirmation grace period, auto-assignment rule config (see M2), default assignee pools per category |
| **MANAGEMENT_STAFF** | Condo-wide (read-only SLA) | View SLA and escalation parameters; **cannot edit** policy (admin-only write); billing/role settings remain admin-only |
| **UNIT_OWNER** | Condo-wide (read-only audit) | **No SLA policy editing.** Read-only access to **SLA settings audit log** (G1). Unit notification preferences elsewhere (channels, quiet hours) |

**SLA configuration UX (slider-based)**

- Per-priority **resolution** sliders (URGENT / HIGH / NORMAL / LOW), backed by `SlaPolicy` rows.
- **Single-slider UX:** management sets resolution window only; **first-response is auto-derived at 40% of resolution** (two stored values, one control).
- Each slider shows **advisory bands** as management drags:
  - **Recommended** (green) — product default for Malaysian condos.
  - **Acceptable** (amber) — still defensible; no save friction.
  - **Risky** (red) — beyond feasible staffing norms; triggers save warning.
- **Risky-band thresholds are dynamic** — derived from condo size / unit count (not a fixed per-priority table). Bands are advisory; the UI should not hard-block saves.
- If any priority lands in the **risky** band → **warning prompt** before save (explain impact on resident expectations and breach rates).
- If management **proceeds anyway** (risky band) → system **auto-publishes a public announcement** immediately on save (radical transparency / owner empowerment alignment).
- Saves that stay within **recommended or acceptable** bands → **audit log only**; no resident announcement.
- **No one-click rollback** on SLA changes — management must manually re-enter prior values if they want to revert.
- **AT_RISK threshold:** fixed **20%** of window remaining (not admin-editable).
- **Breach notifications:** assignee **and** all management users.
- **`UNIT_OWNER`:** read-only access to the **SLA settings audit log** (condo-scoped; cannot edit policy).

**Risky-SLA transparency announcement (auto-published on proceed)**

| Field | Required | Notes |
| --- | --- | --- |
| Title | Yes | e.g. "Helpdesk response times updated" |
| What changed | Yes | Per-priority before → after table |
| Effective date | Yes | When new threads / reprioritisations pick up the policy |
| Rationale | No | Optional free-text from management at save time |
| Link to settings audit entry | Yes | Deep link or reference ID for accountability |

**Delta from spec (remaining gaps)**

- ✅ Assignee pool editor in settings UI — web `/admin/settings/helpdesk` pool picker + `PUT /sla/condo/:id/auto-assignment`.
- ✅ `UNIT_OWNER` read-only SLA audit log surface (G1) — `/sla-audit` resident page.
- ✅ Resident-profile quiet hours (E5) — `/settings` web + mobile; push suppressed during quiet hours.

**Acceptance (draft)**

- `MANAGEMENT_ADMIN` can view/edit SLA windows per priority via slider UI with advisory bands; `MANAGEMENT_STAFF` read-only.
- Dragging into the risky band shows a warning; confirming save after warning auto-publishes the transparency announcement immediately.
- Saves within recommended/acceptable bands write audit log only (no resident announcement).
- SLA change recalculates due dates on **all open threads** (not only new/reprioritised).
- SLA clock runs **24/7** (no business-hours pause).
- Configurable resolution-confirmation grace period (default **7 days**) replaces the hardcoded constant.
- Role-scoped CASL abilities enforce admin-only write on `SlaPolicy`; staff read-only; residents/owners/tenants cannot edit.
- Audit log entry on every settings change (actor, timestamp, before/after values, whether risky warning was acknowledged, optional rationale, linked announcement ID when risky).

**Decided (Rounds 1–2 — locked)**

| ID | Decision |
| --- | --- |
| **A1** | **Dynamic risky bands** based on condo size / unit count |
| **A2** | Auto-publish announcement **immediately** when saving risky SLA |
| **A3** | `MANAGEMENT_ADMIN` only can edit SLA; staff **read-only** |
| **A4** | **All open threads** — recalculate due dates on SLA change |
| **A5** | **Resolution slider per priority**; first-response auto-derived at **40%** of resolution (single slider UX, two stored values) |
| **A6** | Fixed **20%** AT_RISK threshold |
| **A7** | Breach notifications: **assignee + all management** |
| **A8** | Normal-band saves: **audit log only**, no resident announcement |
| **A9** | **No one-click rollback** — manual re-enter only |
| **A10** | Default grace period: **7 days** (configurable in S1 settings) |
| **D9** | SLA clock runs **24/7** |
| **G1** | `UNIT_OWNER` **read-only** access to SLA settings audit log |

**Decided (Round 3 — locked)**

| ID | Decision |
| --- | --- |
| **F1** | SLA settings panel on **web admin and mobile management** in v0.2 |
| **D10** | Priority override **recalculates SLA due date immediately** (agent decision — user deferred) |
| **E5** | **Fully user-configurable quiet hours** in resident profile |

### M1 — Enhanced resolution flow ✅ Done (partial)

**Status:** ✅ Done (partial) · **Priority:** P1 · **Roadmap:** v0.2 · **Shipped:** commit `41b2ff6` (+ CI fix `af7256f`)

**Built (v0.2)**

- ✅ Accepted-answer pattern — `resolutionProposedMessageId` on propose; management can change proposed message while `PENDING_RESIDENT_CONFIRMATION` (B1/B2).
- ✅ Propose-resolve gate — blocked while `AWAITING_RESIDENT` (B13); allowed after first management response even if resident never replied (B5/B6).
- ✅ Reject flow — freeform **why rejecting** + **what they still want** required (B3); web + mobile UX.
- ✅ Configurable grace period from S1 settings; auto-confirm scanner uses "silent since last management message" (B4); auto-confirm → `RESOLVED` (B7/B8).
- ✅ 14-day total-inactivity auto-close (D6); `TENANT` thread create (D1); any household member can confirm (D2).
- ✅ Explicit appeal/reopen with required reason (B9/B10); SLA continues from original due date (B12); appeal notifies original assignee (B11).
- ✅ Reopen count badge on management thread header (G3); resident message on `RESOLVED` auto-reopens (B15).

**Deferred**

- None (D7 + E1 shipped in follow-on pass).

Refine the resident-driven resolution model (D2 ✅) toward the full product vision: Stack Overflow–style accepted solution, resident-retained final say, and configurable grace period.

**Thread access & lifecycle (cross-cutting)**

- **`TENANT`** may open threads — same flow and SLA as `UNIT_OWNER`.
- **Auto-close:** threads close after **14 days total inactivity** (both sides silent); distinct from resolution-confirmation grace period.

**Target flow**

1. Resident or tenant opens a thread → management works the ticket (replies, internal notes, reassignment).
2. Management **proposes resolved** when they believe the issue is fixed — may propose **anytime after they have responded**, even if the resident never replied; **blocked while `AWAITING_RESIDENT`** (resident owes a reply).
3. Management marks a **specific reply** as the proposed solution (Stack Overflow accepted-answer pattern); resident sees it prominently at confirm time.
4. **Any household member** linked to the unit may confirm resolution (not only the thread opener).
5. Resident **accepts** the solution (explicit confirm) → thread `RESOLVED` → flow ends.
6. Resident **rejects** → must provide freeform text: **why rejecting** and **what they still want** (captured in M1 spec).
7. If resident does not accept within the **grace period** (default **7 days**, configurable via S1) → system auto-confirms → thread **`RESOLVED`** (not `CLOSED`).
8. **"Silent"** for auto-confirm = no resident message since the **last management message**.
9. Any **new resident message on `RESOLVED`** auto-reopens the thread (keep current behaviour).
10. Resident may **appeal** via explicit reopen (unlimited reopens); **reason text required**; SLA continues from **original due date** (no reset on reopen).

**Delta from spec (remaining gaps)**

| Aspect | Status | Gap |
| --- | --- | --- |
| Abusive-thread handling | ✅ | **D7** — `POST /threads/:id/close-abusive`; resident notified |
| Email notification opt-in | ✅ | **E1** — `PATCH /auth/preferences`; Resend when configured |
| All other M1 acceptance items | ✅ | Shipped in `41b2ff6` + follow-on |

**Acceptance (draft)**

- Mark a specific management reply as the "proposed solution" (accepted-answer pattern) shown prominently at confirm time.
- Configurable grace period (S1, default 7 days) drives auto-confirm scanner; silence = no resident message since last management message.
- Propose-resolve blocked while `AWAITING_RESIDENT`; otherwise allowed anytime after management has responded.
- Reject flow captures freeform **why rejecting** + **what they still want**.
- Auto-confirm within grace period → `RESOLVED`.
- Any resident message on `RESOLVED` auto-reopens (keep current).
- `TENANT` can open threads (same flow/SLA as owner).
- 14-day total-inactivity auto-close (both sides silent).
- Any household member linked to the unit can confirm resolution.
- Explicit reopen/appeal UX with **required** reason text; unlimited reopens; SLA continues from original due date on reopen.
- Default notifications: in-app + mobile push; email opt-in from profile.

**Decided (Rounds 1–2 — locked)**

| ID | Decision |
| --- | --- |
| **B1** | Specific management message marked as **proposed solution** (Stack Overflow style) |
| **B3** | Reject requires resident to type **why rejecting** AND **what they still want** (freeform) |
| **B4** | **"Silent"** = no resident message since last management message |
| **B5** | **No general gate** on propose-resolve — not blocked by resident silence or prior thread history; allowed anytime after management has responded (see **B6**, **B13**) |
| **B6** | Management can propose-resolve anytime after they've responded, **even if resident never replied** |
| **B7** | Auto-confirm → **`RESOLVED`** status |
| **B9** | **Unlimited** reopens/appeals |
| **B10** | **Required** reason text on reopen/appeal |
| **B12** | SLA continues from **original due date** on reopen (no reset) |
| **B13** | **Sole exception to B5:** **block** propose-resolve while **`AWAITING_RESIDENT`** (resident owes a reply to an explicit management request) |
| **B15** | Any new resident message on **`RESOLVED`** auto-reopens (keep current) |
| **D1** | **`TENANT`** can open threads — same flow/SLA as owner |
| **D2** | Any **household member** linked to unit can confirm resolution |
| **D6** | Auto-close after **14 days** total inactivity (both sides silent) |
| **E1** | Default: in-app + mobile push; user can **opt-in to email** (email from profile default) |

**Decided (Round 3 — locked)**

| ID | Decision |
| --- | --- |
| **B2** | Management can **change proposed-solution message** anytime while `PENDING_RESIDENT_CONFIRMATION` |
| **B8** | After auto-confirm → `RESOLVED`, **same appeal rules** apply (required reason, unlimited) |
| **B11** | Appeal/reopen notifies **original assignee only** |
| **D3** | Internal notes **never visible** to residents; push/email previews must not leak |
| **D4** | `AWAITING_RESIDENT` — SLA clock **continues** (no pause) |
| **D7** | Management can **flag + close abusive threads** with reason; resident notified |
| **G3** | Show **reopen count badge** on thread header for management |

### M2 — Thread auto-assignment ✅ Done (partial — phase 1)

**Status:** ✅ Done (partial — phase 1) · **Priority:** P2 · **Roadmap:** v0.2 (rules) → v0.3 (ML, optional) · **Shipped:** commit `cc4147e` (+ CI fix `af7256f`)

When a resident opens a thread, the system should assign it to the right management handler based on priority/category — reducing manual triage.

**Phased approach (recommended)**

| Phase | When | Approach |
| --- | --- | --- |
| **Phase 1 — Rules** | v0.2 | Deterministic routing: category → team/assignee pool, priority → senior staff or on-call roster, round-robin within pool, fallback to unassigned + notify all management (current behaviour). Configured via S1. |
| **Phase 2 — ML** | v0.3+ (opt-in) | Enabled at **200+ closed threads** per condo, behind **opt-in feature flag**; deterministic rules remain fallback. Plugs into existing `AI_ASSIST_PROVIDER` seam alongside `RuleBasedAiAssistProvider`. |

**Built (phase 1 — v0.2)**

- ✅ `ThreadAssignmentService` — on create: category → assignee pool, GENERAL → `generalTriagePool`, round-robin within pool, repeat complainant (3+/30d) → `seniorStaffPool` (C1/C5).
- ✅ Recategorise → immediate reassign to new category pool (C4); unassigned fallback still notifies all management (C2); any management user can reassign (C3).
- ✅ Duplicate-thread suggestions surfaced on thread detail (D5); repeat-complainant flag on header.
- ✅ Pools configured via `condo.settings.helpdesk.autoAssignment` JSON + **pool editor UI** in S1 settings.
- ✅ **F3** inbox default sort (breach → at risk → priority → oldest).
- ✅ **F4** FAQ deflection at compose (`POST /faq/deflect-match`; web + mobile).
- ✅ **G2** PDF export (`GET /threads/:id/export.pdf`).

**Deferred**

- 🟡 **Phase 2 ML** (**C6**) — scaffold/seam now shipped: `AssignmentAssistProvider` seam (`assignment-assist.provider.ts` + `composite-assignment-assist.provider.ts`) and `ml/ml-assignment.service.ts` gated behind `ML_ASSIGNMENT_MIN_CLOSED_THREADS = 200` + an opt-in admin toggle on `/admin/settings/helpdesk`; a **real trained model is still future** (current provider is a stub, deterministic rules remain fallback).

**Delta from spec (remaining gaps)**

- **Priority suggestion** ✅ — unchanged; `RuleBasedAiAssistProvider` on thread create.
- **Auto-assignee** ✅ — `assignedToUserId` set on create from rules; `THREAD_ASSIGNED` notification when assigned.
- **ML assignment** 🟡 — seam + 200-thread gate + opt-in flag + stub provider shipped; trained model still future.
- **Assignment on priority change** ✅ — priority override now re-routes the assignee via `assignOnPriorityChange` (in addition to SLA due-date recompute).

**Acceptance (draft)**

- Phase 1: new threads get `assignedToUserId` from rules; `THREAD_ASSIGNED` notification fires; any management user can reassign (C3).
- Phase 1: unassigned threads notify all management (C2).
- Phase 1: assignment rules editable in S1 settings panel.
- Phase 2 (optional): ML suggester behind feature flag; always overridable; deterministic rules remain fallback.

**Decided (Rounds 1–2 — locked)**

| ID | Decision |
| --- | --- |
| **C1** | Phase 1: **category → assignee pool** routing |
| **C2** | Unassigned fallback: **notify all management** |
| **C3** | Any management user can **reassign** |

**Decided (Round 3 — locked)**

| ID | Decision |
| --- | --- |
| **C1** | **"Other" category** → general/triage assignee pool (**S1** configurable) |
| **C4** | **Recategorise** → auto-reassign to new category pool **immediately** |
| **C5** | **No VIP unit routing**; repeat complainants (3+ threads/30 days) → auto-route to senior staff + flag on header |
| **C6** | ML phase 2 enabled at **200+ closed threads** per condo, behind **opt-in feature flag**; rules remain fallback (agent decision — user deferred) |
| **D5** | System **suggests possible duplicate threads**; management decides (no hard merge in v0.2) |
| **E2** | Every management reply → **immediate in-app + push** (no digest in v0.2) |
| **F3** | Inbox default sort: **SLA breach → AT_RISK → priority → oldest** |
| **F4** | FAQ deflection: strong FAQ match offers **"This answered my question"** to close without opening thread |
| **G2** | **PDF export:** management + resident can export own threads (v0.2) |

## Planned features (cross-referenced to roadmap)

| ID | Priority | Roadmap | Description |
| --- | --- | --- | --- |
| **F1** | ✅ Done | v0.3 | Visitor Collaboration v2 — two-path visitor flow. |
| **F2** | 🟡 Partial | v1.0 | Dedicated `SUPER_ADMIN` platform / multi-condo view — basics at `/admin/platform`. |
| **F4** | ✅ Done | v0.5 | First-time setup / onboarding wizard — guided condo bootstrap for a brand-new deployment. |

### F4 — First-time setup / onboarding wizard

> **Status:** ✅ Done · shipped in `6dd4f00`; redirect trap removed in `a4baa2a` (banner + **Finish setup** nav only) · **Priority:** P1 · **Area:** api + web

When SmartResidence is deployed for a brand-new JMB/MC with an empty database (no demo seed), an admin needs a guided, foolproof way to stand the building up — today this only happens via the seed script. Build a **first-time setup wizard** that detects a fresh/unconfigured condo and walks the first admin through the essentials, in order, with validation and the ability to resume.

**Suggested steps (decide/refine when we start):**

1. **Create the condo** — name, address, state, timezone, currency (default MYR / Asia/Kuala_Lumpur), locale, brand color + logo.
2. **First management admin** — confirm/adjust the bootstrapping admin account (the person running setup) and optionally invite co-admins/staff.
3. **Structure** — add blocks, unit types (with sqft/fee basis), and units (manual add + bulk/CSV import).
4. **Billing basics** — unit-type fee rates (maintenance + sinking fund), receipt template, billing automation schedule (opt-in), and at least one payment gateway (or "cash/manual only" for now).
5. **Residents** — invite owners/tenants (single + bulk), or defer.
6. **Operations toggles** — visitor policy (walk-in approval, overnight rules, holidays), helpdesk SLA defaults, announcement channels.
7. **Optional integrations** — MCP servers, email/WhatsApp providers.
8. **Review & finish** — summary checklist, mark condo as "configured", land on the admin dashboard.

**Design notes / open questions:**

- **Detection:** a condo/instance-level `setupCompletedAt` (or `settings.setup`) flag; incomplete setup surfaces banner + **Finish setup** nav (no forced redirect off other admin pages).
- **Resumable:** persist progress per step so setup can be paused and continued; each step is independently editable later from normal settings.
- **Idempotent & safe:** re-running a step must not duplicate data; guard against partial/abandoned setups.
- **Bootstrapping the very first admin** on a truly empty instance (no users) — how is that account created (env-seeded owner, install token, CLI)? Ties into `SUPER_ADMIN`/multi-condo (F2).
- **Reuse existing surfaces** (unit-types, billing settings, gateway connect, roles) rather than rebuilding forms — the wizard orchestrates them.
- **Self-hosting story:** pairs with `make dev` / demo seed; a fresh production deploy should reach a working condo without touching the database directly.

### F1 — Visitor Collaboration v2

Two-path flow:

- **Fast lane.** Owner pre-registers a visitor; the guard sees the expected list. The visitor scans a QR code OR enters a short human-friendly access code (McDonald's-app style); the guard confirms on device → checked in with minimal friction.
- **Strict walk-in.** The guard gathers info and **owner approval is MANDATORY before entry — NO guard/supervisor override**. If the owner is unreachable, the visitor waits or leaves.
- **Exception.** Visitors for the **management office** may enter (logged, routed to management).
- Every attempt (approved / rejected / no-response) is logged to the owner's unit activity.
- Offline-tolerant at the gate.

Future sub-items: vehicle plate / ANPR field, ~~blacklist~~ ✅ (shipped, V4), ~~recurring passes~~ ✅ (shipped, V4), ~~delivery / e-hailing passes~~ ✅ (shipped, `6dd4f00`/`a4baa2a`). **Guard on-site admit** ✅ kept per product decision (audited + owner notified).

### F2 — Dedicated SUPER_ADMIN platform / multi-condo view

> **Status:** 🟡 Partial · **Area:** api + web · **Shipped:** `PlatformModule` + `/admin/platform` (condo list/search, detail, setup badges, open-condo-admin switch)

Super admin currently has a dedicated **Platform console** at `/admin/platform` for cross-condo list/search and per-condo detail. **Still future:** condo provisioning, plan/usage, feature flags, support impersonation (audited), aggregate health.

## Tech debt

| ID | Priority | Area | Description |
| --- | --- | --- | --- |
| **T1** | ✅ Done | CI | Repo-wide lint for green CI. |
| **T2** | P3 | tests | Confirm test-config additions are acceptable long-term. |

### T1 — Repo-wide lint for green CI ✅ Done

Full-repo `corepack pnpm lint` now exits 0 (warnings only; no errors).

- ✅ Added generated `apps/docs/.docusaurus` (plus generated Expo `expo-env.d.ts` / `nativewind-env.d.ts`) to Biome's ignore list.
- ✅ Fixed the residual **error**-level issues: `organizeImports` import-sort in `auth.service.ts` and `format` in `apps/mobile/tsconfig.json`. Remaining `noExplicitAny` / `noNonNullAssertion` items (incl. `seed.ts`, `owner.controller.ts`) are configured as warnings and are acceptable.

### T2 — Confirm test-config additions

A prior pass added `--passWithNoTests` to `shared-types` and an `apps/web/vitest.config.ts` excluding Playwright `e2e/**` to make `pnpm test` green. Confirm these are acceptable long-term.
