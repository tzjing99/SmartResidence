.PHONY: help install dev infra-up infra-down infra-logs db-migrate db-seed db-reset db-studio test lint format typecheck build clean docs release

help:
	@echo "SmartResidence - common tasks"
	@echo ""
	@echo "  make install      Install dependencies (pnpm)"
	@echo "  make dev          Start everything (infra + apps)"
	@echo "  make infra-up     Start Docker services (Postgres, Redis, MinIO, Mailpit)"
	@echo "  make infra-down   Stop Docker services"
	@echo "  make infra-logs   Tail Docker service logs"
	@echo "  make db-migrate   Apply Prisma migrations"
	@echo "  make db-seed      Seed the database with a demo condo"
	@echo "  make db-reset     Drop, migrate, and re-seed"
	@echo "  make db-studio    Open Prisma Studio"
	@echo "  make test         Run all tests"
	@echo "  make lint         Run Biome lint"
	@echo "  make format       Run Biome format --write"
	@echo "  make typecheck    Run typecheck across the workspace"
	@echo "  make build        Build all apps"
	@echo "  make clean        Remove node_modules and build outputs"

install:
	pnpm install

infra-up:
	docker compose -f infra/docker/docker-compose.yml up -d
	@echo ""
	@echo "  Postgres : postgresql://smartresidence:smartresidence@localhost:5432/smartresidence"
	@echo "  Redis    : redis://localhost:6379"
	@echo "  MinIO    : http://localhost:9001 (smartresidence/smartresidence)"
	@echo "  Mailpit  : http://localhost:8025"
	@echo ""

infra-down:
	docker compose -f infra/docker/docker-compose.yml down

infra-logs:
	docker compose -f infra/docker/docker-compose.yml logs -f

db-migrate:
	pnpm --filter @smartresidence/api db:migrate

db-seed:
	pnpm --filter @smartresidence/api db:seed

db-reset:
	pnpm --filter @smartresidence/api db:reset

db-studio:
	pnpm --filter @smartresidence/api db:studio

dev: infra-up
	pnpm dev

test:
	pnpm test

lint:
	pnpm lint

format:
	pnpm format

typecheck:
	pnpm typecheck

build:
	pnpm build

clean:
	pnpm clean

docs:
	pnpm docs:dev

release:
	pnpm release
