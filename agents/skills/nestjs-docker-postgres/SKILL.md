---
name: nestjs-docker-postgres
description: >
  Docker and PostgreSQL connection setup for this repo.
  Load when setting up Docker, configuring the database connection, or running e2e tests.
metadata:
  author: @rodrigozucchini
  version: "2.0"
---

# NestJS Docker + PostgreSQL Skill

---

## When to Use

Load when the user:
- Sets up Docker for the first time
- Configures the TypeORM connection in `app.module.ts`
- Runs e2e tests that need a real PostgreSQL DB
- Adds environment variables related to the DB

---

## Docker Services

El proyecto tiene **tres servicios** en `docker-compose.yaml`:

| Servicio | Container | Puerto | Uso |
|---|---|---|---|
| `postgres` | `waiona_postgres` | `POSTGRES_PORT` (default 5432) | DB principal — desarrollo |
| `postgres_test` | `waiona_postgres_test` | `POSTGRES_TEST_PORT` (default 5433) | DB para e2e tests |
| `pgadmin` | `waiona_pgadmin` | `5050` | Interfaz visual de la DB |

---

## Comandos Útiles

```bash
# levantar todo
docker compose up -d

# levantar solo la DB principal
docker compose up -d postgres

# levantar DB principal + DB de tests
docker compose up -d postgres postgres_test

# ver estado de los containers
docker compose ps

# detener sin borrar datos
docker compose stop

# reset completo (borra volúmenes)
docker compose down -v

# logs de postgres
docker compose logs postgres

# conectarse a psql
docker exec -it waiona_postgres psql -U waiona_user -d waiona_db
```

---

## Variables de Entorno

```properties
# DB principal
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=waiona_db
POSTGRES_USER=waiona_user
POSTGRES_PASSWORD=waiona_password

# DB de tests (para e2e)
POSTGRES_TEST_DB=waiona_test
POSTGRES_TEST_PORT=5433

# pgAdmin
PGADMIN_EMAIL=admin@waiona.com
PGADMIN_PASSWORD=admin123
```

---

## TypeORM Connection en app.module.ts

```typescript
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env>) => ({
    type:     'postgres',
    host:     config.get('POSTGRES_HOST', { infer: true }),
    port:     config.get('POSTGRES_PORT', { infer: true }),
    username: config.get('POSTGRES_USER', { infer: true }),
    password: config.get('POSTGRES_PASSWORD', { infer: true }),
    database: config.get('POSTGRES_DB', { infer: true }),
    autoLoadEntities: true,
    synchronize: process.env.NODE_ENV !== 'production',
  }),
}),
```

---

## TypeORM Connection en e2e Tests

Los e2e tests usan `postgres_test` (puerto 5433) con `dropSchema: true` para limpiar entre runs:

```typescript
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type:     'postgres',
    host:     config.get('POSTGRES_HOST') ?? 'localhost',
    port:     parseInt(config.get('POSTGRES_TEST_PORT') ?? '5433'),
    username: config.get('POSTGRES_USER'),
    password: config.get('POSTGRES_PASSWORD'),
    database: config.get('POSTGRES_TEST_DB') ?? 'waiona_test',
    entities:    [/* entidades del módulo */],
    synchronize: true,   // solo en tests
    dropSchema:  true,   // limpia la DB antes de cada suite
  }),
}),
```

---

## pgAdmin

Una vez levantado `docker compose up -d`:
- URL: `http://localhost:5050`
- Email: valor de `PGADMIN_EMAIL`
- Password: valor de `PGADMIN_PASSWORD`

Agregar servidor:
- **Host**: `postgres` (nombre del container, no `localhost`)
- **Port**: `5432`
- **Username/Password**: los del `.env`

---

## Common Mistakes

- **`host: localhost` en pgAdmin**: Dentro de Docker, los containers se ven por nombre — usar `postgres`.
- **Sin `depends_on` en pgAdmin**: pgAdmin puede arrancar antes que Postgres — el `healthcheck` lo previene.
- **Usar `postgres_test` para desarrollo**: Tiene `dropSchema: true` — borra todos los datos al reiniciar.
- **`synchronize: true` en producción**: Puede alterar el schema automáticamente — usar `false` y migraciones.
- **Olvidar levantar `postgres_test` para e2e**: Los tests fallan con connection refused — `docker compose up -d postgres postgres_test`.