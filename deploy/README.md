# `deploy/` — PROPOSED self-host / cloud artifacts (DRAFT)

> ⚠️ **DRAFT — not wired into CI, not the canonical dev stack.**
>
> These files are a *proposal* for a full self-hosted bring-up of SmartResidence
> (infra **plus** the API and web app images), produced as part of the
> planning deliverable in [`docs/SELF_HOSTING.md`](../docs/SELF_HOSTING.md) and
> [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
>
> The **canonical local development** stack remains
> [`infra/docker/docker-compose.yml`](../infra/docker/docker-compose.yml)
> (infra only: Postgres, Redis, MinIO, Mailpit) + `pnpm dev`. Nothing here
> changes that. Review, adjust, and promote these files deliberately before
> using them in production.

## What's here

| File | Purpose |
| ---- | ------- |
| `docker-compose.selfhost.yml` | Full self-host topology: Postgres, Redis, MinIO (+init), Mailpit, **api**, **web**, and a one-shot **migrate** job. Builds the app images from the existing `infra/docker/Dockerfile.api` / `Dockerfile.web`. |
| `.env.example` | Single `.env` for the whole self-host stack (copy → `.env`, fill secrets). |

## Reused, not reinvented

The app image builds reuse the Dockerfiles that already exist in the repo:

- `infra/docker/Dockerfile.api` — multi-stage NestJS build, `EXPOSE 4000`, `HEALTHCHECK` on `/health`.
- `infra/docker/Dockerfile.web` — multi-stage Next.js standalone build, `EXPOSE 3000`.

The build **context is the repo root** (`..` relative to this folder) because both
Dockerfiles copy `pnpm-lock.yaml`, `packages/`, and the app source from the
monorepo root.

## Quick use (draft)

```bash
cp deploy/.env.example deploy/.env
# edit deploy/.env — set strong secrets

docker compose -f deploy/docker-compose.selfhost.yml --env-file deploy/.env up -d --build
# the "migrate" service applies Prisma migrations on startup (runs once, then exits)

# App: http://localhost:3000   API: http://localhost:4000/health   Mail UI: http://localhost:8025
```

Seeding demo data is a **separate, deliberate step** (the production API image
ships only compiled `dist/`, not the TypeScript seed). See
[`docs/SELF_HOSTING.md`](../docs/SELF_HOSTING.md#seeding-demo-data) for the two
supported paths (dev-image seed vs. first-time setup wizard).
