---
title: "ADR 0002: Postgres RLS for multi-tenancy"
sidebar_label: "0002 — Postgres RLS"
---

# ADR 0002 — Postgres Row-Level Security

**Status:** Accepted, 2026-01.
**Context:** SmartResidence is multi-tenant from day one. App-layer checks
alone leak data the moment a developer forgets a `where` clause.
**Decision:** Enforce isolation in the database with RLS policies, driven by
GUC variables set by Prisma per request.
**Consequences:**

- ✅ Defence in depth — app code is the second line, not the only line.
- ✅ Background workers and ad-hoc psql sessions inherit the same rules.
- ❌ All queries must run inside `withTenantContext` (or an explicit
  `asService` for privileged paths).
- ❌ Some Prisma features (e.g. raw SQL) require care to keep RLS active.

Alternatives considered: schema-per-tenant (operationally heavy), DB-per-
tenant (cost-prohibitive at small condo size), app-layer-only (rejected).
