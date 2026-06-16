---
name: postgres-infra
description: >
  PostgreSQL + Docker infrastructure for this repo: Docker services, DB commands, naming conventions,
  synchronize vs migrations, raw SQL operations, and pgAdmin setup.
  Load when working with Docker, database schema, debugging queries, or managing environments.
metadata:
  author: @rodrigozucchini
  version: "1.0"
---

# PostgreSQL Infrastructure Skill

Cubre todo lo relacionado a la infraestructura de base de datos: Docker, conexión, naming, sincronización, migraciones y operaciones SQL directas.

---

## When to Use

Load when the user:
- Sets up or troubleshoots Docker
- Adds a column, relation, or index to an entity
- Runs raw SQL against the DB
- Debugs a TypeORM query
- Generates or runs migrations
- Needs to reset or seed data manually

Do NOT load when:
- Writing TypeScript entities or DTOs (use `typeorm-standard`)
- Writing tests (use `testing-standard`)

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

## Docker — Comandos

```bash
# levantar TODO (API + DB + pgAdmin)
docker compose up --build

# en background
docker compose up -d --build

# solo DB principal
docker compose up -d postgres

# DB principal + test
docker compose up -d postgres postgres_test

# estado
docker compose ps

# logs de la API / postgres
docker compose logs api
docker compose logs postgres

# detener sin borrar datos
docker compose stop

# reset total (borra volúmenes)
docker compose down -v

# conectarse a psql dentro del container
docker exec -it postgres psql -U waiona_user -d waiona_db
```

---

## pgAdmin

Una vez levantado Docker:
- URL: `http://localhost:5050`
- Email / Password: `PGADMIN_EMAIL` y `PGADMIN_PASSWORD` del `.env`

Agregar servidor en pgAdmin:
- Host: `postgres` (nombre del container, no `localhost`)
- Puerto: `5432`
- Usuario / Password: los del `.env`

---

## Synchronize vs Migraciones

```typescript
// app.module.ts
TypeOrmModule.forRoot({
  synchronize:
    process.env.DB_SYNCHRONIZE === 'true' ||
    process.env.NODE_ENV !== 'production',
  autoLoadEntities: true,
})
```

**En desarrollo** — `synchronize: true` activo. Modificá la entidad, reiniciá con `npm run start:dev`, TypeORM aplica el cambio solo.

**En producción** — `synchronize` desactivado. El `entrypoint.sh` corre `migration:run:prod` automáticamente al arrancar el contenedor.

**⚠️ Nunca `synchronize: true` en producción** — puede borrar columnas renombradas sin aviso.

---

## Migraciones

```bash
# generar desde cambios en entidades (requiere DB disponible)
npm run migration:generate -- src/database/migrations/NombreCambio

# aplicar en dev
npm run migration:run

# aplicar en producción (usa dist/ compilado)
npm run migration:run:prod

# revertir última migración
npm run migration:revert
```

---

## Naming Conventions

| Elemento | Convención | Ejemplo |
|---|---|---|
| Tabla | `snake_case` plural | `order_items`, `stock_locations` |
| Columna sin `name:` | TypeORM usa camelCase en DB | `isActive`, `createdAt` |
| Columna con `name:` | snake_case explícito | `category_id`, `deleted_at` |
| FK | `<relacion>_id` | `category_id`, `user_id` |
| Enum values | snake_case | `super_admin`, `out_of_stock` |

---

## Columnas camelCase en SQL

TypeORM genera columnas en camelCase cuando no se define `name:`. En SQL hay que escaparlas con comillas dobles:

```sql
-- ✅ columna sin name: (camelCase en DB)
SELECT "createdAt", "isActive" FROM users;
UPDATE users SET "isActive" = true WHERE id = 1;

-- ✅ columna con name: (snake_case en DB, sin comillas)
SELECT * FROM users WHERE deleted_at IS NULL;

-- ❌ sin comillas — PostgreSQL convierte a lowercase
SELECT createdat FROM users;  -- falla silenciosamente
```

---

## Raw SQL Útil

```sql
-- Ver tablas existentes
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Ver columnas de una tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products';

-- Ver registros soft-deleted
SELECT * FROM orders WHERE deleted_at IS NOT NULL;

-- Restaurar un soft-deleted
UPDATE users SET deleted_at = NULL WHERE id = 5;

-- Reset de tabla (solo dev)
TRUNCATE TABLE tokens RESTART IDENTITY CASCADE;
```

---

## Problema: columna NOT NULL con datos existentes

`synchronize` falla al agregar `nullable: false` a una tabla con registros existentes.

**Solución:**
```sql
-- 1. agregar nullable
ALTER TABLE products ADD COLUMN category_id INT NULL;

-- 2. poblar datos existentes
UPDATE products SET category_id = 1 WHERE category_id IS NULL;

-- 3. reiniciar el server — TypeORM aplica NOT NULL
```

---

## Common Mistakes

- **`synchronize: true` en producción**: Puede borrar columnas renombradas sin advertencia.
- **Sin comillas en columnas camelCase**: `isActive` sin comillas → PostgreSQL lo lee como `isactive` → error silencioso.
- **Hard delete**: Siempre usar `deleted_at = NOW()` en SQL directo, nunca `DELETE FROM`.
- **Host `localhost` en pgAdmin**: El container de pgAdmin no puede resolver `localhost` — usar el nombre del servicio `postgres`.
- **Agregar NOT NULL sin migración manual**: Ver sección anterior.
