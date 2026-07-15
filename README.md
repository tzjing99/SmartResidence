# SmartResidence

> A modern, open-source condo / strata management platform — mobile app for
> residents and security guards, web portal for management. Built because
> existing community-management apps are slow, ugly, and treat owners like
> they're not in charge of their own homes.

SmartResidence is an opinionated alternative to closed, low-quality apps like
eCommunity. It is designed around three principles:

1. **Owner empowerment & radical transparency.** If something happens on your
   unit — a fee adjustment, a visitor approval, an admin opening your record —
   you see it. No hidden charges. No silent admin actions.
2. **AirBnB-grade UX.** Fluid animations, generous whitespace, friendly
   empty-states, dark mode, real haptics on mobile.
3. **Self-hostable from day one.** `make dev` boots the whole stack against
   Docker. A condo's JMB can run it on a $5 VPS.

Repository: https://github.com/tzjing99/SmartResidence

## Status

**v0.3.0 alpha.** Resident, management, and guard flows are available for local
evaluation. See the [roadmap](./docs/ROADMAP.md) and
[current handoff](./docs/HANDOFF.md) for shipped scope and known gaps.

## Stack

| Layer        | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| Mobile       | React Native + Expo SDK 54, Expo Router, Reanimated, Moti     |
| Web          | Next.js 15 (App Router, RSC), Tailwind, shadcn/ui             |
| API          | NestJS on Node.js 22                                          |
| Database     | PostgreSQL 16 with Row-Level Security, Prisma 5               |
| Cache/queue  | Redis + BullMQ                                                |
| Auth         | Better Auth (email/OTP, passkeys, 2FA)                        |
| Payments     | Stripe + pluggable adapters (iPay88, Razer, FPX)              |
| Storage      | S3-compatible (MinIO in dev, AWS S3 in prod)                  |
| Notifications| Expo Push, Web Push, Resend (email), Twilio (SMS/WhatsApp)    |
| Realtime     | Socket.IO                                                     |
| Monorepo     | pnpm workspaces + Turborepo                                   |
| Lint/format  | Biome                                                         |

## Repository layout

```
apps/
  api/          NestJS REST + WebSocket backend
  web/          Next.js (resident portal + /admin management dashboard)
  mobile/       Expo app (resident + guard mode)
  docs/         Published Docusaurus documentation site
packages/
  shared-types/ Zod schemas + inferred TS types shared across apps
  api-client/   Auto-generated typed client from OpenAPI spec
  ui-web/       Web component library (shadcn/Radix + Tailwind)
  ui-mobile/    Mobile component library (NativeWind + Reanimated/Moti)
  config-tsconfig/ Shared TypeScript configuration
deploy/         Full local/self-host Docker topology
infra/
  docker/       Dev infrastructure + API/web Dockerfiles
docs/           Maintainer, operator, product, and engineering guides
scripts/        Maintenance utilities and archived one-off migrations
```

## Run locally with Docker (recommended)

You only need **Git** and **Docker Desktop** (or Docker Engine with Compose v2).
Node.js and pnpm are not required for this Docker path.

### 1. Clone and prepare the local environment

```powershell
git clone https://github.com/tzjing99/SmartResidence.git
cd SmartResidence
Copy-Item deploy/.env.example deploy/.env
```

macOS/Linux:

```bash
git clone https://github.com/tzjing99/SmartResidence.git
cd SmartResidence
cp deploy/.env.example deploy/.env
```

The supplied values are for a **localhost-only demo**. Change the secrets in
`deploy/.env` before exposing the system to a LAN, VPS, or the internet.

### 2. Start the entire browser stack

```bash
docker compose up -d --build
docker compose run --rm seed
```

That is all. Docker builds and starts:

- PostgreSQL and Redis
- MinIO object storage
- Mailpit development email
- the NestJS API
- the Next.js web app
- a one-shot database migration job

The first build can take several minutes. Check progress with:

```bash
docker compose ps
docker compose logs -f api web
```

### 3. Open SmartResidence

| Service | URL |
| ------- | --- |
| Web app | http://localhost:3000 |
| API health | http://localhost:4000/health |
| Mailpit inbox | http://localhost:8025 |
| MinIO console | http://localhost:9001 |

The demo seed creates these accounts (password: **`Demo!2026`**):

| Role | Email |
| ---- | ----- |
| Resident | `owner@acacia.demo` |
| Management | `admin@acacia.demo` |
| Guard | `guard@acacia.demo` |

Sign in at http://localhost:3000/sign-in. Management and guard accounts are
routed to their own workspaces after login. The local Docker login page shows
the resident credentials and provides a one-click fill button. Set
`SHOW_DEMO_CREDENTIALS=false` in `deploy/.env` for a real deployment.

### Stop or reset

```bash
docker compose down       # stop; keep database and uploaded files
docker compose down -v    # stop and permanently delete local demo data
```

The same commands are available as `corepack pnpm docker:up`, `docker:seed`,
`docker:status`, `docker:logs`, and `docker:down` for contributors using pnpm.

## Development mode (hot reload)

For API/web/mobile development, install **Node.js 22+**, enable Corepack, and
run the infrastructure in Docker while the apps run on the host:

```bash
corepack enable
corepack pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

Windows PowerShell uses `Copy-Item` instead of `cp`.

### Mobile app (LAN only)

Testing on a physical phone uses your **local Wi‑Fi**, not tunneling. Do **not**
run `expo start --tunnel` or install ngrok — this project does not include
`@expo/ngrok`.

1. Copy `apps/mobile/.env.example` → `apps/mobile/.env`.
2. Set `EXPO_PUBLIC_API_URL` to your PC's LAN IP (e.g. `http://192.168.1.42:4000`).
3. Run `corepack pnpm mobile:dev` (or `pnpm dev` for the full stack).
4. Scan the Expo QR code with Expo Go; phone and PC must be on the same network.
5. Allow firewall access to ports **4000** (API) and **8081** (Metro) if needed.

See [`apps/mobile/README.md`](./apps/mobile/README.md) for details. Cursor agents must follow [`.cursor/rules/mobile-dev-network-security.mdc`](./.cursor/rules/mobile-dev-network-security.mdc).

Default seeded credentials are printed by the seed script. You can log in to:

- **Resident**: `owner@acacia.demo` / `Demo!2026`
- **Management**: `admin@acacia.demo` / `Demo!2026`
- **Guard**: `guard@acacia.demo` / `Demo!2026`

## Contributing

We welcome contributions of every size — bug reports, translations, design
critiques, code. Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md). Every PR should reference an issue
or RFC.

## License

[AGPL-3.0-or-later](./LICENSE). If you run a modified SmartResidence as a
network service, you must publish your modifications. Commercial hosting is
allowed and encouraged — just keep the source open.
