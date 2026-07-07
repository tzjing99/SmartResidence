# @smartresidence/mobile

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
