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

After `make dev` you should have:

- API on http://localhost:4000 (`/docs` for Swagger)
- Resident/admin web on http://localhost:3000
- Expo dev server (scan with Expo Go or build a dev-client)
- Mailpit on http://localhost:8025
- MinIO console on http://localhost:9001

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

- Read the [Architecture overview](./architecture/overview.md)
- Learn how SmartResidence implements [owner empowerment](./architecture/owner-empowerment.md)
- Review the [self-hosting guide](./self-hosting.md) before going to production
