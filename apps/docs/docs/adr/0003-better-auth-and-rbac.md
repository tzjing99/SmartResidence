---
title: "ADR 0003: Better Auth + CASL"
sidebar_label: "0003 — Auth + RBAC"
---

# ADR 0003 — Better Auth + CASL

**Status:** Accepted, 2026-01.
**Context:** We need email/OTP, passkeys, 2FA, refresh-token rotation, and
session/device management without rolling our own crypto.
**Decision:** Use Better Auth as the auth substrate, layered with our own
session model in Postgres for revocation guarantees, and CASL as the single
RBAC rules engine consumed by the API guard, the web shell, and the mobile
app.
**Consequences:**

- ✅ Passkeys / 2FA / OTP for free.
- ✅ One source of truth for "what can this role do" — re-used everywhere.
- ✅ Revoking a role can kill sessions in O(1) Redis writes.
- ❌ Two libraries to upgrade in lockstep.
- ❌ CASL ability rules are JSON-serialised; tooling around them is lighter
  than e.g. OPA / Cedar.

Alternatives considered: Keycloak (too heavy for self-hosters), Auth0 (not
self-hostable), home-rolled JWT auth (rejected).
