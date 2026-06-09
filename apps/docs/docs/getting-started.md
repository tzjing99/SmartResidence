---
sidebar_position: 1
title: Getting started
---

# Getting started with SmartResidence

SmartResidence is an open-source condo / strata management platform with a
mobile app, web portal and admin dashboard, built around an audit-first,
**owner-empowering** model.

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for Postgres, Redis, MinIO)
- A clone of [`tzjing99/SmartResidence`](https://github.com/tzjing99/SmartResidence)

## Quick start

```bash
git clone https://github.com/tzjing99/SmartResidence.git
cd SmartResidence
make install      # pnpm install
make infra-up     # Postgres + Redis + MinIO + Mailpit
make db-migrate   # Apply Prisma migrations + RLS
make db-seed      # Demo condo, units, users
make dev          # Run API + Web + Mobile in parallel
```

After pulling schema or migration changes, run `pnpm db:migrate` (or `make db-migrate`) — it applies migrations and regenerates the Prisma client.

After `make dev` you should have:

- API on http://localhost:4000 (`/docs` for Swagger)
- Resident/admin web on http://localhost:3000
- Expo dev server (scan with Expo Go or build a dev-client)
- Mailpit on http://localhost:8025
- MinIO console on http://localhost:9001

## Mobile app (LAN only)

Physical-device testing uses your **local network**. SmartResidence does **not**
ship `@expo/ngrok` or support `expo start --tunnel` — do not use tunneling or
ngrok (many corporate networks block it).

1. Copy `apps/mobile/.env.example` to `apps/mobile/.env`.
2. Set `EXPO_PUBLIC_API_URL` to your dev machine's LAN IP, e.g.
   `http://192.168.1.42:4000` (use `ipconfig` / `ifconfig` to find it).
3. From the repo root: `corepack pnpm mobile:dev` (or `make dev` for everything).
4. Connect phone and PC to the **same Wi‑Fi** and scan the QR code in the terminal.
5. Open firewall ports **4000** (API) and **8081** (Metro) if the device cannot connect.

More detail: [`apps/mobile/README.md`](https://github.com/tzjing99/SmartResidence/blob/main/apps/mobile/README.md).

## Demo accounts

The seed script creates an `Acacia Heights` condo with the following users
(all password `Smart!1234`):

| Email                          | Role          |
| ------------------------------ | ------------- |
| owner@example.com              | Unit owner    |
| tenant@example.com             | Tenant        |
| admin@example.com              | Mgmt admin    |
| guard@example.com              | Security guard |

## Next steps

- Understand [visitor pre-reg vs walk-in flows](./features/visitors.md)
- Read the [Architecture overview](./architecture/overview.md)
- Learn how SmartResidence implements [owner empowerment](./architecture/owner-empowerment.md)
- Review the [self-hosting guide](./self-hosting.md) before going to production
