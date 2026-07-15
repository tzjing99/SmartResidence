# `deploy/` — local Docker and self-host artifacts

> The root [`compose.yaml`](../compose.yaml) includes this stack to provide the
> simplest local browser-based trial. It builds the API and web images locally;
> published GHCR images are not required.
>
> For an internet-facing deployment, replace all sample secrets, add TLS and a
> reverse proxy, configure backups, and complete the production checklist in
> [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
>
> The **canonical local development** stack remains
> [`infra/docker/docker-compose.yml`](../infra/docker/docker-compose.yml)
> (infra only) + `pnpm dev` when hot reload or Expo mobile development is needed.

## What's here

| File | Purpose |
| ---- | ------- |
| `docker-compose.selfhost.yml` | Full self-host topology: Postgres, Redis, MinIO (+init), Mailpit, **api**, **web**, and a one-shot **migrate** job. Builds the app images from the existing `infra/docker/Dockerfile.api` / `Dockerfile.web`. |
| `.env.example` | Single `.env` for the whole self-host stack (copy → `.env`, fill secrets). |

## Reused, not reinvented

The app image builds reuse the Dockerfiles that already exist in the repo:

- `infra/docker/Dockerfile.api` — multi-stage NestJS build, `EXPOSE 4000`, `HEALTHCHECK` on `/health`.
- `infra/docker/Dockerfile.web` — multi-stage Next.js standalone build, `EXPOSE 3000`.
  Builds `@smartresidence/shared-types` first (package exports `dist/`), and accepts
  `NEXT_PUBLIC_API_URL` as a build arg (wired from `API_PUBLIC_URL` in compose).

The build **context is the repo root** (`..` relative to this folder) because both
Dockerfiles copy `pnpm-lock.yaml`, `packages/`, and the app source from the
monorepo root. A root `.dockerignore` keeps mobile/docs/`node_modules` out of the
context.

## Quick local use

```bash
cp deploy/.env.example deploy/.env
docker compose up -d --build
docker compose run --rm seed

# App: http://localhost:3000   API: http://localhost:4000/health   Mail UI: http://localhost:8025
```

The `migrate` service applies Prisma migrations automatically. The explicit
`seed` command loads the Acacia Residence demo and can be omitted for a clean
installation; use `/admin/setup` instead.
