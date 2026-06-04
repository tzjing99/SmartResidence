---
sidebar_position: 2
title: Self-hosting
---

# Self-hosting SmartResidence

SmartResidence is designed to run anywhere you can run Postgres, Redis and a
Node container. The reference deployment is Docker Compose for small
communities and Kubernetes for larger Joint Management Bodies (JMBs).

## Requirements

- Postgres 15+ with the `pgcrypto` extension
- Redis 7+
- S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Backblaze B2…)
- An SMTP server (Resend, SES, or your own)
- Optional: Stripe and/or a local payment gateway (FPX/iPay88/Razer)

## Docker Compose (small community)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
docker compose run --rm api pnpm prisma migrate deploy
docker compose run --rm api pnpm prisma db seed   # optional demo data
```

The compose file ships sane defaults and a generated `.env` so a community
manager can be running in 10 minutes.

## Kubernetes (larger deployment)

Reference manifests live in `infra/k8s/` (Helm chart coming in v0.2). At a
minimum you'll want:

- A managed Postgres (RDS, Cloud SQL, Neon)
- ElastiCache or self-hosted Redis with persistence
- Object storage with private bucket policies
- Two replicas of the API pod, one of the web pod
- A scheduled job for `prisma migrate deploy` on releases

## Required environment variables

See `apps/api/.env.example` and `apps/web/.env.example`. The most important:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
BETTER_AUTH_SECRET=change-me
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
S3_ENDPOINT=...
S3_BUCKET=smartresidence-prod
STRIPE_SECRET_KEY=sk_live_...
EXPO_PUSH_ACCESS_TOKEN=...
```

## Backups

Run `pg_dump` daily to S3 with a 30-day rotation. The full schema is in
`apps/api/prisma/schema.prisma`; restoring is a `pg_restore` away.

## Upgrading

Releases follow semver. Minor versions never break the API; major versions
include a runnable `pnpm migrate:upgrade` script.
