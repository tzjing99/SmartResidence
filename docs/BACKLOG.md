# SmartResidence Backlog

Tracked defects and deferred refinements not yet scheduled into a milestone; see [docs/ROADMAP.md](./ROADMAP.md) for the phased plan.

> This file is hand-maintained. Items are moved into a [docs/ROADMAP.md](./ROADMAP.md) milestone when they are scheduled.

Priority legend: **P1** (high) · **P2** (medium) · **P3** (low).

## Defects

| ID | Priority | Area | Description |
| --- | --- | --- | --- |
| **D1** | P1 | web + mobile | Announcement rich-text rendering. Announcement bodies are authored/stored as markdown but render as literal text (e.g. `## Notice from JMB` and `**June 12, 2026**` appear raw instead of formatted). |
| **D2** | P2 | api + web | Helpdesk thread behavior does not match the intended resident-driven resolution model. |

### D1 — Announcement rich-text rendering

Render markdown/rich text on display in **both** the web announcements pages and the mobile app, **and** provide a rich-text editor in the admin announcements composer (`apps/web/src/app/admin/announcements/page.tsx`).

- Decide on a safe, sanitized markdown renderer for display.
- Add a lightweight rich-text/markdown editor for authoring.

Test case (the sample notice should render formatted, not raw):

```markdown
## Notice from JMB
The water utility will be performing pipe maintenance on **June 12, 2026** from **10am to 2pm**. Please store water in advance.
```

### D2 — Helpdesk thread behavior

Current implementation lets management resolve tickets unilaterally and flips status on resident reply — both need changing.

- **(a) Comments while `AWAITING_MANAGEMENT`.** A resident may add additional comments, but the status must STAY `AWAITING_MANAGEMENT` (resident comments do not flip the ball back to the resident).
- **(b) Resident-driven resolution.** The resident confirms/marks a thread resolved; management cannot unilaterally close it. Management may "propose resolved", which then requires resident confirmation, with an auto-close-after-N-days fallback if the resident goes silent.
- **(c) Explicit requests to resident.** Management moves a ticket to `AWAITING_RESIDENT` only as an explicit "request to resident"; the resident's reply moves it back to `AWAITING_MANAGEMENT`.

## Deferred UI polish

| ID | Priority | Area | Description |
| --- | --- | --- | --- |
| **H1** | P2 | web | Helpdesk dashboard polish. Pairs with D2 (same pass). |

### H1 — Helpdesk dashboard polish

The current admin Helpdesk inbox is cluttered and the SLA state is hard to read.

- Cleaner inbox layout with priority + status + assignee + SLA columns.
- Unmistakable SLA chips: green **On-track** / amber **At-risk** / red **Breached**, showing the actual due time.
- Better visual grouping.

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
| **T1** | P2 | CI | Repo-wide lint for green CI. |
| **T2** | P3 | tests | Confirm test-config additions are acceptable long-term. |

### T1 — Repo-wide lint for green CI

Full-repo `corepack pnpm lint` still exits 1 on pre-existing issues in files not touched recently.

- Add generated `apps/docs/.docusaurus` artifacts to Biome's ignore list.
- Clean residual import-sort / `noExplicitAny` items in `seed.ts`, `auth.service.ts`, `owner.controller.ts`, and `apps/mobile/tsconfig.json` so the CI lint job is green.

### T2 — Confirm test-config additions

A prior pass added `--passWithNoTests` to `shared-types` and an `apps/web/vitest.config.ts` excluding Playwright `e2e/**` to make `pnpm test` green. Confirm these are acceptable long-term.
