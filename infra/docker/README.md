# SmartResidence dev infra

`docker compose up` boots the full local development stack:

| Service  | Purpose                              | URL / Port                         |
| -------- | ------------------------------------ | ---------------------------------- |
| Postgres | Primary database                     | `localhost:5432`                   |
| Redis    | Cache + BullMQ                       | `localhost:6379`                   |
| MinIO    | S3-compatible object storage         | API `:9000`, Console `:9001`       |
| Mailpit  | Outgoing-mail catcher for dev        | SMTP `:1025`, UI `localhost:8025`  |

Default credentials are intentionally weak for development. Production
deployments must override every password through environment variables.

```bash
pnpm infra:up        # or: make infra-up
pnpm infra:down
pnpm infra:logs
```

The `minio-init` one-shot container creates a bucket called `sr-uploads` and
sets `sr-uploads/public` to anonymous-download (used for visitor QR pass
images).
