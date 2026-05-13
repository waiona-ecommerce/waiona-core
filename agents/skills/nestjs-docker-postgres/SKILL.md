---
name: nestjs-docker-postgres
description: >
  Full Docker setup for NestJS API + PostgreSQL + pgAdmin.
  Load when working with Docker, database connections, or running the full stack locally.
metadata:
  author: @rodrigozucchini
  version: "3.0"
---

# NestJS Docker + PostgreSQL Skill (Full Stack)

---

## When to Use

Load when the user:
- Sets up Docker for the first time
- Wants to run the **entire stack (API + DB + pgAdmin)** with one command
- Configures TypeORM connection
- Runs e2e tests with a real PostgreSQL DB
- Works with environment variables in Docker

---

## Docker Services

El proyecto tiene **cuatro servicios** en `docker-compose.yml`:

| Servicio | Container | Puerto | Uso |
|---|---|---|---|
| `api` | `waiona_api` | `3000` | API NestJS |
| `postgres` | `waiona_postgres` | `${POSTGRES_PORT}` (default 5432) | DB principal |
| `postgres_test` | `waiona_postgres_test` | `${POSTGRES_TEST_PORT}` (default 5433) | DB para e2e |
| `pgadmin` | `waiona_pgadmin` | `5050` | UI de la DB |

---

## Comandos Útiles

```bash
# levantar TODO (API + DB + pgAdmin)
docker compose up --build

# en background
docker compose up -d --build

# solo la API
docker compose up api

# solo DB principal
docker compose up -d postgres

# DB principal + test
docker compose up -d postgres postgres_test

# estado
docker compose ps

# logs de la API
docker compose logs api

# logs de postgres
docker compose logs postgres

# detener
docker compose stop

# reset total (borra datos)
docker compose down -v