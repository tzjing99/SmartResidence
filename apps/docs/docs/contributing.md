---
sidebar_position: 3
title: Contributing
---

# Contributing

We welcome contributions of every size — from typo fixes to new payment
adapters. Please read [`CONTRIBUTING.md`](https://github.com/tzjing99/SmartResidence/blob/main/CONTRIBUTING.md)
and the [Code of Conduct](https://github.com/tzjing99/SmartResidence/blob/main/CODE_OF_CONDUCT.md).

## Local setup

```bash
make install
make infra-up
make db-migrate
make db-seed
make dev
```

## Conventions

- TypeScript everywhere. `pnpm typecheck` must be clean.
- Biome handles formatting + linting. Run `pnpm lint:fix` before committing.
- Conventional commits (`feat:`, `fix:`, `chore:`…). Changesets manage
  versioning automatically.
- Every API change should bring tests (Vitest) and an updated OpenAPI snapshot
  (it's generated automatically in CI).
- UI work should ship a Storybook story.

## How we accept work

1. Open an issue describing the problem before doing big work.
2. Open a draft PR early; we prefer small, reviewable PRs.
3. Sign your commits if you can — DCO is enabled on the repo.
4. Be kind. Strata living is stressful enough; our code review shouldn't be.
