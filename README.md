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

Alpha. The v0.1 milestone targets the core resident + management + guard flows
(visitor pre-registration, maintenance fee viewing/payment, defect submission,
announcements). See [`docs`](./docs) and the project roadmap.

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
packages/
  shared-types/ Zod schemas + inferred TS types shared across apps
  api-client/   Auto-generated typed client from OpenAPI spec
  ui-web/       Web component library (shadcn/Radix + Tailwind)
  ui-mobile/    Mobile component library (NativeWind + Reanimated/Moti)
  config-*/     Shared tsconfig/Biome
infra/
  docker/       docker-compose.yml for local dev + self-hosting
  k8s/          Helm chart for production
  db/           Prisma schema lives in apps/api; this folder holds backups/ops
docs/           Docusaurus documentation site
```

## Quick start (development)

Requirements: **Node 22+**, **pnpm 9+**, **Docker** (for Postgres / Redis /
MinIO / Mailpit).

```bash
git clone https://github.com/tzjing99/SmartResidence.git
cd SmartResidence
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm infra:up        # Postgres + Redis + MinIO + Mailpit on Docker
pnpm db:migrate      # apply Prisma migrations
pnpm db:seed         # load a demo condo (Acacia Heights, 3 blocks, 120 units)

pnpm dev             # runs api + web + mobile in parallel
```

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
