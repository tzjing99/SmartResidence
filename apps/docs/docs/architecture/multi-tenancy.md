---
sidebar_position: 2
title: Multi-tenancy
---

# Multi-tenancy and RLS

A single SmartResidence deployment can run many condos. We isolate them at
two layers:

1. **App layer:** every authenticated request resolves an active condo. CASL
   guards reject queries that touch a different condo.
2. **Database layer:** Postgres Row-Level Security policies are applied to
   every tenant-scoped table.

## How RLS is wired

`apps/api/src/prisma/prisma.service.ts` exposes a `withTenantContext` helper
that opens a Prisma transaction, sets three Postgres GUC variables —
`app.current_user_id`, `app.current_condo_id`, `app.current_role` — and runs
the query. RLS policies in `prisma/migrations/rls.sql` then read those GUCs
to filter rows.

```ts
await prisma.withTenantContext(user, async (tx) => {
  return tx.invoice.findMany({ where: { unit: { ownerId: user.id } } });
});
```

A privileged background worker can call `prisma.asService()` to bypass RLS
when, for example, processing a payment webhook. That path is audited.

## Why not just app-layer checks?

Because the moment someone forgets a `where` clause, half the building gets
to read the other half's data. RLS makes the failure mode "no rows" instead
of "everyone's rows".
