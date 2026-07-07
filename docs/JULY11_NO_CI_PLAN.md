# Path C — Local verify without GitHub Actions

> **Effective:** 2026-07-07 through **2026-08-01** (GH Actions budget $0)

## Policy

Merge PRs when local verification passes. GitHub Actions green checks are **not required** during this window if the user has approved Path C for the change.

## Per-PR checklist (worktree)

```powershell
git fetch origin
git rebase origin/main
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
# When Docker + Postgres available:
corepack pnpm ci:test:api
corepack pnpm ci:test:regression
```

Record pass/fail for each step in the merge report.

## Jul 7 merges (Path C)

| PR | lint | typecheck | api | regression | merged |
| --- | --- | --- | --- | --- | --- |
| #12 governance proxy voting | pass | pass | skip (no Docker) | skip | Y |
| #20 PDPA user export | pass | pass | skip | skip | Y |
| #24 self-host docs | pass | pass | skip | skip | Y |

**Final `main` SHA:** `92e0249`

## Exclusions

- **#1 changeset-release** — never merge without explicit PO approval.
- **#22 mobile a11y** — reviewed 2026-07-07; kept open (incremental a11y beyond #23).
