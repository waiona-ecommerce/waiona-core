---
name: postgres-standard
description: >
  PostgreSQL conventions for this repo: naming, synchronize vs migrations, common queries, and day-to-day DB operations.
  Load when working with the database schema, naming columns, debugging queries, or managing the DB in development.
metadata:
  author: @rodrigozucchini
  version: "2.0"
---

# PostgreSQL Standard Skill

---

## When to Use

Load when the user:
- Adds a new column or relation to an entity
- Runs raw SQL against the DB
- Debugs a TypeORM query
- Sets up the DB for a new environment
- Needs to reset or seed data manually

Do NOT load when:
- Writing TypeScript entities or DTOs (use `typeorm-standard`)
- Configuring Docker (use `nestjs-docker-postgres`)

---

## Dev Mode: `synchronize: true`

In **development**, `synchronize: true` is active in `app.module.ts`. TypeORM automatically applies schema changes when the app restarts. **No manual migrations needed in dev.**

```typescript
// app.module.ts — current setup
TypeOrmModule.forRoot({
  synchronize: process.env.NODE_ENV !== 'production', // true in dev, false in prod
  autoLoadEntities: true,
})
```

**Day-to-day workflow in dev:**
1. Modify the entity (add column, relation, index)
2. Restart the app (`npm run start:dev`)
3. TypeORM applies the change automatically

**⚠️ Never use `synchronize: true` in production.** It can drop columns if you rename them.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Table | `snake_case` plural | `order_items`, `stock_locations` |
| Column | `camelCase` in TS → `snake_case` in DB via `name:` | `categoryId` → `category_id` |
| FK column | `<relation>_id` | `category_id`, `user_id` |
| Index | Defined with `@Index` in entity | — |
| Enum | `snake_case` values | `super_admin`, `out_of_stock` |

---

## Common Raw SQL Operations

**Ver tablas existentes:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

**Ver columnas de una tabla:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products';
```

**Agregar columna manualmente (cuando synchronize no puede por datos existentes):**
```sql
ALTER TABLE products ADD COLUMN category_id INT NULL;
UPDATE products SET category_id = 1 WHERE category_id IS NULL;
-- luego reiniciar el server para que aplique NOT NULL
```

**Soft delete manual:**
```sql
UPDATE users SET "isDeleted" = true WHERE id = 5;
```

**Ver registros soft-deleted:**
```sql
SELECT * FROM orders WHERE "isDeleted" = true;
```

**Reset de una tabla (solo dev):**
```sql
TRUNCATE TABLE tokens RESTART IDENTITY CASCADE;
```

---

## Columnas con camelCase en SQL

TypeORM usa camelCase para las columnas que no tienen `name:` explícito. En SQL hay que escaparlas con comillas dobles:

```sql
-- ✅ correcto
SELECT "isDeleted", "createdAt" FROM users;
UPDATE users SET "isActive" = true WHERE id = 1;

-- ❌ incorrecto (interpreta como lowercase)
SELECT isdeleted FROM users;
```

---

## Problema: `synchronize` no puede agregar columna NOT NULL con datos existentes

Cuando agregás una columna `nullable: false` a una tabla con registros, el sync falla porque PostgreSQL no puede setear `NOT NULL` sin un valor por defecto.

**Solución en 3 pasos:**
```sql
-- 1. Agregar la columna como nullable
ALTER TABLE products ADD COLUMN category_id INT NULL;

-- 2. Asignar valores a los registros existentes
UPDATE products SET category_id = 1 WHERE category_id IS NULL;

-- 3. Reiniciar el server — TypeORM aplica el NOT NULL constraint
```

---

## Migraciones (producción)

En producción, usar migraciones en lugar de `synchronize`. Generar desde los cambios en entidades:

```bash
# generar migración
npx typeorm migration:generate src/database/migrations/AddCategoryToProduct -d src/database/ormconfig.ts

# correr migraciones
npx typeorm migration:run -d src/database/ormconfig.ts

# revertir última migración
npx typeorm migration:revert -d src/database/ormconfig.ts
```

---

## Docker — Comandos Útiles

```bash
# levantar DB y pgAdmin
docker compose up -d

# detener sin borrar datos
docker compose stop

# detener y borrar volúmenes (reset completo)
docker compose down -v

# ver logs de postgres
docker compose logs postgres

# conectarse a psql dentro del container
docker exec -it postgres psql -U waiona_user -d waiona_db
```

---

## Acceder a pgAdmin

Una vez levantado Docker:
- URL: `http://localhost:5050`
- Email: `PGADMIN_EMAIL` del `.env`
- Password: `PGADMIN_PASSWORD` del `.env`

Agregar servidor en pgAdmin:
- Host: `postgres` (nombre del container)
- Puerto: `5432`
- Usuario/Password: los del `.env`

---

## Common Mistakes

- **`synchronize: true` en producción**: Puede borrar columnas renombradas o alterar el schema sin control.
- **Sin comillas en columnas camelCase**: PostgreSQL convierte a lowercase — `isDeleted` → `isdeleted` sin comillas.
- **Hard delete en lugar de soft delete**: Siempre usar `isDeleted = true` — nunca `DELETE FROM`.
- **Agregar NOT NULL sin datos en columnas existentes**: Siempre agregar nullable primero, poblar datos, luego aplicar NOT NULL.