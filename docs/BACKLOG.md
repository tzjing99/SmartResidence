# SmartResidence Backlog

Tracked defects and deferred refinements not yet scheduled into a milestone; see [docs/ROADMAP.md](./ROADMAP.md) for the phased plan.

> This file is hand-maintained. Items are moved into a [docs/ROADMAP.md](./ROADMAP.md) milestone when they are scheduled.

Priority legend: **P1** (high) · **P2** (medium) · **P3** (low).

## Recently completed

- ✅ **D2 — Helpdesk thread behavior** — resident-driven resolution model: management "proposes resolved" (new `PENDING_RESIDENT_CONFIRMATION` status + `resolutionProposedAt`/`resolutionProposedByUserId`), resident confirms/rejects, resident comments while `AWAITING_MANAGEMENT` no longer flip status, explicit "request to resident" action, and a 7-day auto-confirm fallback in the scheduled scanner.
- ✅ **H1 — Helpdesk dashboard polish** — cleaner admin inbox (columns for subject/requester/priority/status/assignee/SLA), unmistakable SLA chips (On track / At risk / Breached with time remaining), category + assignee filters, sort by SLA due, and the new D2 affordances surfaced in the thread detail + resident view.
- ✅ **D1 — Announcement rich-text rendering** — sanitized markdown rendering on web (resident + admin pages) and mobile, plus a live markdown preview in the admin composer.
- ✅ **T1 — Repo-wide lint for green CI** — `corepack pnpm lint` now exits 0 (ignored generated dirs incl. `.docusaurus`; fixed residual format/import-sort errors).

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
| **H1** | ✅ Done | web | Helpdesk dashboard polish. Pairs with D2 (same pass). |

### H1 — Helpdesk dashboard polish ✅ Done

- ✅ Cleaner inbox layout with subject / requester+unit / priority / status / assignee / SLA columns (card rows, responsive grid, framer-motion list).
- ✅ Unmistakable SLA chips via a shared `<SlaChip>`: green **On track** / amber **At risk** / red **Breached**, each showing the time remaining or overdue amount (breached/at-risk get a coloured ring to pop), exact due time in the tooltip.
- ✅ Category + assignee filters added (status/priority/SLA retained) plus **sort by SLA due**; sensible empty states; new D2 affordances surfaced (management "Propose resolved" / "Request from resident", resident "Confirm resolved / Not resolved", pending-confirmation banner) with i18n keys (en/ms/zh-Hans).

## Planned features (cross-referenced to roadmap)

| ID | Priority | Roadmap | Description |
| --- | --- | --- | --- |
| **F1** | P1 | v0.3 | Visitor Collaboration v2 — two-path visitor flow. |
| **F2** | P3 | future | Dedicated `SUPER_ADMIN` platform / multi-condo view. |

### F1 — Visitor Collaboration v2

Two-path flow:

- **Fast lane.** Owner pre-registers a visitor; the guard sees the expected list. The visitor scans a QR code OR enters a short human-friendly access code (McDonald's-app style); the guard confirms on device → checked in with minimal friction.
- **Strict walk-in.** The guard gathers info and **owner approval is MANDATORY before entry — NO guard/supervisor override**. If the owner is unreachable, the visitor waits or leaves.
- **Exception.** Visitors for the **management office** may enter (logged, routed to management).
- Every attempt (approved / rejected / no-response) is logged to the owner's unit activity.
- Offline-tolerant at the gate.

Future sub-items: vehicle plate / ANPR field, blacklist, recurring passes, lighter flow for deliveries / e-hailing.

### F2 — Dedicated SUPER_ADMIN platform / multi-condo view

Super admin currently reuses the `/admin` dashboard labeled "Platform portal"; a real multi-condo oversight section is future work.

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
