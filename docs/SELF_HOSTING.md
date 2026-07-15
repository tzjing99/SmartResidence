# Self-hosting & local trial guide

> **Audience:** developers, JMB/MC tech volunteers, and anyone who wants to run
> SmartResidence on their own machine or a small VPS.
>
> **License note:** SmartResidence is **AGPL-3.0-or-later**. You may self-host,
> modify, and run it for your community for free. If you run a *modified* version
> as a network service, you must publish your modifications.

This guide gets you from a clean machine to a working SmartResidence with demo
data. There are two flavours:

1. **Full local Docker trial** (recommended for evaluation) — API, web, and all
   infrastructure start from the root `compose.yaml`.
2. **Developer bring-up** (hot reload + Expo mobile) — infrastructure in Docker,
   apps on the host via `pnpm dev`.

> **Malaysia / mobile note:** per corporate policy and
> [`.cursor/rules/mobile-dev-network-security.mdc`](../.cursor/rules/mobile-dev-network-security.mdc),
> **no tunneling** (`ngrok`, `expo start --tunnel`) is used or supported.
> Physical phones connect over the **LAN only**. See
> [Mobile on a real device](#mobile-on-a-real-device-lan-only).

---

## 1. Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| **Docker Desktop** (or Docker Engine + Compose v2) | current | Runs Postgres, Redis, MinIO, Mailpit — and optionally the app images. |
| **Node.js** | **22+** | Required by the workspace (`engines.node >= 22`). |
| **pnpm** | **9+** | Enable via corepack — don't install globally. |
| **corepack** | bundled with Node | `corepack enable` then `corepack prepare pnpm@9.12.0 --activate`. |
| **Git** | current | To clone the repo. |

Verify:

```bash
node -v      # v22.x
docker -v    # Docker version 2x.x
corepack pnpm -v   # 9.12.0
```

**What actually needs to run** (grounded in `apps/api`):

| Service | Why it's needed | Dev default |
| ------- | --------------- | ----------- |
| **PostgreSQL 16** | Primary database; Row-Level Security enforces multi-tenancy | `postgres:16-alpine`, `:5432` |
| **Redis 7** | Cache + BullMQ queues + realtime fan-out | `redis:7-alpine`, `:6379` |
| **MinIO** (S3-compatible) | Attachments, receipt/QR PNG & PDF storage | `:9000` API, `:9001` console |
| **Mailpit** | Catches outgoing email in dev (no real SMTP needed) | SMTP `:1025`, UI `:8025` |
| **API** (NestJS) | REST + WebSocket backend | `:4000` |
| **Web** (Next.js) | Resident portal + `/admin` + `/guard` | `:3000` |
| **Metro** (Expo) | Mobile dev server (dev only) | `:8081` |

---

## 2. Full local Docker trial (recommended)

Only Git and Docker Desktop / Docker Engine with Compose v2 are required:

```bash
git clone https://github.com/tzjing99/SmartResidence.git
cd SmartResidence
cp deploy/.env.example deploy/.env
docker compose up -d --build
docker compose run --rm seed
```

On Windows PowerShell, replace `cp` with:

```powershell
Copy-Item deploy/.env.example deploy/.env
```

Open http://localhost:3000 and sign in with one of the demo accounts below.
Migrations run automatically. The explicit `seed` command loads demo data; omit
it and use `/admin/setup` when starting a real clean installation.

Useful commands:

```bash
docker compose ps
docker compose logs -f api web
docker compose down       # preserve data
docker compose down -v    # delete all local data
```

> The sample `deploy/.env` values are only suitable for localhost. Replace all
> placeholder credentials before allowing network access.

---

## 3. Developer bring-up (hot reload)

```bash
# 1. Clone
git clone https://github.com/tzjing99/SmartResidence.git
cd SmartResidence

# 2. Install workspace deps
corepack pnpm install

# 3. Environment files (dev defaults already point at local infra)
cp apps/api/.env.example   apps/api/.env
cp apps/web/.env.example   apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# 4. Start infra (Postgres + Redis + MinIO + Mailpit)
corepack pnpm infra:up

# 5. Apply the database schema
corepack pnpm db:migrate

# 6. Load a demo condo (Acacia Heights — blocks, units, invoices, threads…)
corepack pnpm db:seed

# 7. Run API + web + mobile together
corepack pnpm dev
```

The root scripts that back these steps live in `package.json`:
`infra:up` / `infra:down` / `infra:logs`, `db:migrate`, `db:seed`, `db:studio`,
and per-app `api:dev` / `web:dev` / `mobile:dev`.

### Ports & URLs

| What | URL |
| ---- | --- |
| Web app (resident / `/admin` / `/guard`) | http://localhost:3000 |
| API | http://localhost:4000 |
| API health | http://localhost:4000/health |
| API docs (Swagger, **dev only**) | http://localhost:4000/api/docs |
| MinIO console | http://localhost:9001 |
| Mailpit (see all outgoing mail) | http://localhost:8025 |
| Metro (mobile) | http://localhost:8081 |

### Demo accounts

The seed script (`apps/api/prisma/seed.ts`) prints these on completion. Password
for **all** demo users is `Demo!2026`:

| Role | Email | Where to log in |
| ---- | ----- | --------------- |
| Resident (owner) | `owner@acacia.demo` | Web `/` + mobile (resident mode) |
| Resident (tenant) | `tenant@acacia.demo` | Web `/` + mobile |
| Management admin | `admin@acacia.demo` | Web `/admin` |
| Security guard | `guard@acacia.demo` | Web `/guard` + mobile (guard mode) |

> ⚠️ Demo credentials and the weak infra passwords (`smartresidence` /
> `smartresidence`) are for **local trials only**. Never deploy them.

---

## 4. Mobile on a real device (LAN only)

Testing on a physical phone uses your **local Wi‑Fi**, never a tunnel.

1. Find your PC's LAN IP (`ipconfig` on Windows, `ip addr` / `ifconfig` on
   macOS/Linux) — e.g. `192.168.1.42`.
2. In `apps/mobile/.env`, set `EXPO_PUBLIC_API_URL=http://192.168.1.42:4000`
   (the machine IP, **not** `localhost`).
3. Ensure the phone and PC are on the **same Wi‑Fi**.
4. Run `corepack pnpm mobile:dev` (or `corepack pnpm dev` for the full stack).
5. Scan the Expo QR with Expo Go.
6. If the device can't connect, allow inbound firewall on **4000** (API) and
   **8081** (Metro).

Full details: [`apps/mobile/README.md`](../apps/mobile/README.md).

---

## 5. Internet-facing self-hosting

The same full-container topology can be a starting point for a single-VM
deployment, but localhost success does not make it production-ready. Before
exposing it publicly, configure strong secrets, TLS/reverse proxy, backups,
email delivery, public URLs, firewall rules, and monitoring. Follow
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

```bash
cp deploy/.env.example deploy/.env
# Edit deploy/.env — replace every placeholder and set your public URLs.
docker compose up -d --build
```

What the stack does:

- Builds `api` and `web` images from the existing
  `infra/docker/Dockerfile.api` / `Dockerfile.web`.
- Starts Postgres, Redis, MinIO (+ bucket init), and Mailpit.
- Runs a one-shot **`migrate`** service (`prisma migrate deploy`) that applies
  the schema, then exits; `api` waits for it to finish.

Reach it at:

| What | URL |
| ---- | --- |
| Web app | http://localhost:3000 |
| API health | http://localhost:4000/health |
| Mailpit | http://localhost:8025 |

### A note on `NEXT_PUBLIC_API_URL`

Next.js **inlines `NEXT_PUBLIC_*` at build time**. The self-host compose file
passes `API_PUBLIC_URL` into the web image as a **build arg**
(`NEXT_PUBLIC_API_URL`). If your browser reaches the API at something other
than `http://localhost:4000` (e.g. a real domain), set `API_PUBLIC_URL` in
`deploy/.env` and **rebuild** the web image (`docker compose ... build web --no-cache`),
or terminate both web and API behind one reverse proxy so relative/`/api` paths
work. See [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) for the TLS + domain topology.

---

## 6. Seeding demo data

- **Explore with demo data:** `docker compose run --rm seed` loads Acacia
  Residence and the demo accounts. The command uses the API image and the same
  internal PostgreSQL database as the running stack.
- **Start clean (recommended for real communities):** skip the seed command and
  use the built-in **First-time setup wizard** at `/admin/setup`. It walks the
  first admin through condo profile, blocks/units (incl. CSV import), unit-type
  fee rates, billing basics, a payment gateway (or cash/manual), residents, and
  operations toggles — no direct database access required. Setup is resumable and
  surfaces a dashboard banner until complete (no forced redirect).

---

## 7. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| **Ports already in use** (5432/6379/9000/3000/4000) | Stop the conflicting service or remap the port in the compose file. `docker ps` shows what's bound. |
| **API exits on boot with "Invalid environment configuration"** | The Zod env schema (`apps/api/src/config/env.schema.ts`) rejects missing/short secrets. `BETTER_AUTH_SECRET` must be **≥ 32 chars**; `DATABASE_URL`/`REDIS_URL`/`S3_ENDPOINT` must be valid URLs. |
| **`db:migrate` fails on Windows** | Use the root scripts (`corepack pnpm db:migrate`) which call `prisma generate` via `corepack pnpm exec` — the Windows nested-pnpm issue was fixed in the V3 sprint. |
| **Attachments / QR images 404** | Ensure MinIO is healthy and the `sr-uploads` bucket exists with `public` set to anonymous-download (the `minio-init` container does this). |
| **No emails arriving** | In dev, mail is *caught*, not sent — open Mailpit at http://localhost:8025. For real delivery, set `RESEND_API_KEY` or real `SMTP_*`. |
| **Phone can't reach the API** | LAN-only: confirm same Wi‑Fi, correct machine IP in `EXPO_PUBLIC_API_URL`, and firewall inbound on 4000 + 8081. **Do not** use a tunnel. |
| **Web shows API/CORS errors** | `CORS_ORIGINS` on the API must include the web origin; the dev default already includes `http://localhost:3000` and `:8081`. |
| **Reset everything** | `corepack pnpm infra:down` then remove volumes (`docker volume rm` the `postgres_data` / `redis_data` / `minio_data` volumes) to wipe data. |

---

## 8. What's available now vs. requires work

**Available now**

- Root full-stack compose (Postgres, Redis, MinIO, Mailpit, API, web, migrations)
  plus an explicit demo seed job.
- Existing `Dockerfile.api` / `Dockerfile.web` multi-stage production images.
- `/health` liveness/readiness endpoint (checks DB + Redis).
- Prisma migrations + rich demo seed; first-time setup wizard for clean installs.
- Env validation on boot; Swagger auto-disabled in production.

**Requires work (drafts / not yet wired)**

- Internet-facing self-hosting still needs reverse proxy/TLS, backups,
  monitoring, strong secrets, and a security review (see `docs/DEPLOYMENT.md`).
- A Helm chart for Kubernetes is referenced in docs but **not present** in the
  repo yet (`infra/k8s/` is aspirational).
- No Prometheus `/metrics` endpoint yet (only `/health`) — see `docs/DEPLOYMENT.md`.
