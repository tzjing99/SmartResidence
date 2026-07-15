---
sidebar_position: 2
title: Self-hosting
---

# Self-hosting SmartResidence

SmartResidence provides a Docker Compose stack for local evaluation and as a
starting point for a single-server deployment. The canonical, detailed guide is
[`docs/SELF_HOSTING.md`](https://github.com/tzjing99/SmartResidence/blob/main/docs/SELF_HOSTING.md).

## Local Docker trial

Install Git and Docker Desktop (or Docker Engine with Compose v2), then run:

```shell
git clone https://github.com/tzjing99/SmartResidence.git
cd SmartResidence
cp deploy/.env.example deploy/.env
docker compose up -d --build
docker compose run --rm seed
```

On Windows PowerShell, use
`Copy-Item deploy/.env.example deploy/.env` instead of `cp`.

Open:

- Web app: http://localhost:3000
- API health: http://localhost:4000/health
- Development email: http://localhost:8025
- MinIO console: http://localhost:9001

The demo password is `Demo!2026`; the sign-in page shows the local demo
account when `SHOW_DEMO_CREDENTIALS=true`.

## What runs

The root `compose.yaml` starts PostgreSQL 16, Redis 7, MinIO, Mailpit, the
NestJS API, the Next.js web app, and a one-shot Prisma migration job. Demo
seeding is explicit and can be omitted for a clean installation.

## Production warning

The sample environment is for localhost only. Before exposing SmartResidence
to a network or the internet:

- replace every placeholder secret in `deploy/.env`;
- set public web/API URLs and disable demo credentials;
- add TLS and a reverse proxy;
- configure real email/object storage and backups;
- review firewall, monitoring, and security requirements.

There is currently no maintained Kubernetes/Helm deployment in this repository.

## More information

See the canonical
[self-hosting guide](https://github.com/tzjing99/SmartResidence/blob/main/docs/SELF_HOSTING.md)
and
[deployment guide](https://github.com/tzjing99/SmartResidence/blob/main/docs/DEPLOYMENT.md).
