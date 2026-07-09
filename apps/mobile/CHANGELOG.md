# @smartresidence/mobile

## 0.3.0

### Minor Changes

- e0900ef: PDPA account deletion: resident-initiated anonymization with confirmation, session revoke, and billing history retained
- Finalize Jul 11 backlog: visitor RBAC correction, i18n locale picker + error toasts, renovation permit QR verify/PDF, self-host Docker web build fix, and SUPER_ADMIN feature flags (F2 extras).

### Patch Changes

- 44cd07d: AGM/EGM e-voting: share-weighted quorum, eligibility API, immutable ballot audit (proxy-honoring tallies)
- 1c1a1b9: Follow OS Dynamic Type / Android font scale with tiered maxFontSizeMultiplier caps.
- Updated dependencies [7cb6774]
- Updated dependencies [44cd07d]
- Updated dependencies [1c1a1b9]
- Updated dependencies [e0900ef]
- Updated dependencies
  - @smartresidence/api-client@0.3.0
  - @smartresidence/shared-types@0.3.0
  - @smartresidence/ui-mobile@0.2.1

## 0.2.0

### Minor Changes

- 52c59b6: 🎉 SmartResidence v0.2.0 — July 11 ship-ready release.

  Core platform (v0.1.0 baseline) plus July merge train:

  - **Mobile UX** — dark mode, modern tab bar, visitor pass share card, guard/resident polish
  - **Mobile a11y** — accessibility helpers, icon buttons, minimum touch targets
  - **PDPA** — personal data export (API + web + mobile settings)
  - **Governance** — proxy voting, immutable results audit, AGM minutes + financial snapshot
  - **Billing** — resident statement CSV/receipt downloads, TNG sandbox adapter
  - **Platform** — SUPER_ADMIN console F2
  - **i18n** — phases 1–3 (nav/shell, page content, guard/auth/live screens)
  - **Web a11y** — WCAG AA lite pass
  - **Auth** — session and device management UI
  - **Observability** — Prometheus metrics scrape endpoint
  - **Tests** — integration/regression hardening for billing and visitor flows
  - **Self-host (draft)** — `deploy/docker-compose.selfhost.yml`, SELF_HOSTING.md, DEPLOYMENT.md

### Patch Changes

- Updated dependencies [52c59b6]
  - @smartresidence/api-client@0.2.0
  - @smartresidence/shared-types@0.2.0
  - @smartresidence/ui-mobile@0.2.0
