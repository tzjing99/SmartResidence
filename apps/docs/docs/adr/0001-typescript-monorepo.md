---
title: "ADR 0001: TypeScript monorepo"
sidebar_label: "0001 — TS monorepo"
---

# ADR 0001 — Single-language TypeScript monorepo

**Status:** Accepted, 2026-01.
**Context:** Condo management cuts across mobile, web, and API. A small OSS
team needs to ship features across all three without context-switching.
**Decision:** Use TypeScript everywhere. Manage with pnpm workspaces +
Turborepo.
**Consequences:**

- ✅ One mental model, one toolchain, one set of types.
- ✅ Shared packages (`shared-types`, `api-client`, `ui-*`) are first-class.
- ❌ Forces TS on contributors who would prefer Go/Rust on the API.
- ❌ Workspace tooling has a learning curve.

We considered NestJS + Kotlin Multiplatform, NestJS + Flutter, and a Django
monolith. The contributor-pool argument won.
