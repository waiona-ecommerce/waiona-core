# Docker y CI/CD — Waiona Core

Documentación técnica de cómo interactúan Docker, los tests y el pipeline de GitHub Actions en este proyecto.

---

## Vista General

```
┌─────────────────────────────────────────────────────────────────┐
│                          LOCAL (dev)                            │
│                                                                 │
│   docker-compose.yaml                                           │
│   ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────┐  │
│   │ postgres │  │postgres_test│  │  redis   │  │  pgadmin  │  │
│   └──────────┘  └─────────────┘  └──────────┘  └───────────┘  │
│        ↑               ↑                                        │
│   app en dev      npm run test:e2e                              │
│   (synchronize)   (dropSchema+sync)                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     GITHUB ACTIONS (CI)                         │
│                                                                 │
│  push/PR → master                                               │
│                                                                 │
│  ┌──────┐  ┌───────────┐  ┌───────┐  (paralelo)                │
│  │ lint │  │ test-unit │  │ build │                            │
│  └──┬───┘  └─────┬─────┘  └───┬───┘                            │
│     └────────────┴────────────┘                                 │
│                  ↓ (needs los 3)                                │
│            ┌──────────┐                                         │
│            │ test-e2e │← postgres + redis como service          │
│            └──────────┘   containers efímeros                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCCIÓN (deploy)                         │
│                                                                 │
│   docker build → imagen con dist/ compilado                     │
│   entrypoint.sh → migration:run → node dist/main               │
│                                                                 │
│   ⚠ No hay job de deploy en el CI — deploy es manual           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Docker

### Dockerfile — Multi-Stage Build

El Dockerfile tiene dos etapas separadas para mantener la imagen final liviana:

```dockerfile
# STAGE 1: Builder
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                 # instala TODAS las deps (incluyendo devDeps)
COPY . .
RUN npm run build          # compila TypeScript → dist/

# STAGE 2: Runner
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev      # solo deps de producción (sin devDeps)
COPY --from=builder /app/dist ./dist    # copia solo el compilado
COPY --from=builder /app/public ./public
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
```

**Por qué dos stages:**
- El `builder` necesita TypeScript, ts-node, jest, etc. (devDependencies) para poder compilar.
- El `runner` solo necesita el `dist/` ya compilado + dependencias de producción.
- Sin multi-stage, la imagen final arrastraría ~500MB de devDeps que nunca se usan en prod.

**Resultado:** imagen final liviana — solo Node Alpine + deps de prod + `dist/`.

### .dockerignore

```
node_modules   ← no copiar, se instalan dentro del container
dist           ← se genera en el build stage
coverage       ← artefactos de tests
.git           ← no necesario
.env / .env.*  ← nunca va a la imagen (secretos vía env vars en runtime)
docker-compose ← no necesario dentro de la imagen
*.md           ← documentación
```

El `.env` nunca entra a la imagen. Los secretos se inyectan como variables de entorno en runtime (vía `--env-file` o la plataforma de deploy).

### entrypoint.sh

```sh
#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/.bin/typeorm migration:run -d dist/database/ormconfig.js

echo "Starting application..."
exec node dist/main
```

Cada vez que el container arranca en producción:
1. Corre las migraciones pendientes contra la DB (`dist/database/ormconfig.js`).
2. Arranca la API (`dist/main`).

`set -e` hace que si las migraciones fallan, el container muera en vez de arrancar con schema roto.

---

## docker-compose.yaml — Entorno Local

Define 5 servicios para el entorno de desarrollo local:

### Servicios

```yaml
postgres:           # DB principal — puerto 5432 (o el de .env)
postgres_test:      # DB exclusiva para e2e tests — puerto 5433
pgadmin:            # UI para inspeccionar postgres — puerto 5050
redis:              # Cache + cola BullMQ — puerto 6379
api:                # La API compilada desde el Dockerfile
```

### Healthchecks y dependencias

Cada servicio tiene un `healthcheck` que verifica si está listo:

| Servicio | Comando de health |
|---|---|
| postgres | `pg_isready -U user -d db` |
| postgres_test | `pg_isready -U user -d db_test` |
| redis | `redis-cli ping` |
| api | `wget -qO- http://localhost:3000/health` |

El servicio `api` tiene `depends_on` con `condition: service_healthy` apuntando a `postgres` y `redis`. Esto garantiza que la API no arranca hasta que ambas dependencias estén listas y respondiendo.

`pgadmin` también espera que `postgres` esté healthy antes de arrancar.

### Configuración de red interna

Cuando corre dentro de Docker Compose, la API no usa `localhost` para conectarse a la DB. Usa el nombre del servicio como hostname:

```yaml
api:
  environment:
    POSTGRES_HOST: postgres   ← nombre del servicio, no localhost
    REDIS_HOST: redis         ← ídem
```

Docker Compose crea una red interna donde cada container se resuelve por su nombre de servicio. En desarrollo local (sin Docker) se usa `localhost`.

### La DB de test (`postgres_test`)

Hay una instancia de Postgres separada específicamente para los e2e tests. Corre en el puerto `5433` (no en el `5432` de la DB principal) para que no haya conflicto.

Los e2e tests locales se conectan a esta DB a través de `POSTGRES_TEST_PORT=5433`.

**Nota importante:** el servicio `api` en docker-compose no depende de `postgres_test` — esa DB solo existe para que `npm run test:e2e` pueda correr localmente sin tocar la DB de desarrollo.

### Volúmenes

```yaml
volumes:
  postgres_data:   # persiste datos de la DB principal entre reinicios
  pgadmin_data:    # persiste configuración de pgadmin
```

`redis` no tiene volumen declarado — los datos de Redis (cache, jobs BullMQ) son efímeros y se pierden al reiniciar el container. Esto es intencional: el cache se puede regenerar, y los jobs en cola que no se procesaron antes de un crash son aceptablemente perdidos.

---

## Tests

### Dos tipos: Unit y E2E

| Aspecto | Unit Tests (`*.spec.ts`) | E2E Tests (`*.e2e-spec.ts`) |
|---|---|---|
| Comando | `npm test` | `npm run test:e2e` |
| Config Jest | `package.json` (raíz) | `test/jest-e2e.json` |
| Ubicación | `src/**/*.spec.ts` | `test/**/*.e2e-spec.ts` |
| DB real | No — todo mockeado | Sí — postgres real |
| Redis real | No | Sí (algunos tests) |
| Workers Jest | Default (paralelo) | `maxWorkers: 1` (serial) |

### Unit Tests

Usan mocks de repositorios TypeORM — nunca tocan una DB. Son rápidos y se pueden correr sin ningún servicio externo levantado. Cada spec sigue la convención:

```typescript
// Factory de datos de prueba
const mockEntity = (overrides = {}) => ({ id: 1, name: 'TEST', ...overrides });

// Mock del repositorio
const mockRepo = { findOne: jest.fn(), save: jest.fn(), ... };

afterEach(() => jest.clearAllMocks());
```

Los controllers se testean con `overrideGuard` para saltar autenticación, y pasan el payload JWT directo: `{ sub: 1, role: RoleType.CLIENT }`.

### E2E Tests

Cada archivo e2e levanta su propia aplicación NestJS completa contra la DB real:

```typescript
// Patrón común en todos los e2e specs
TypeOrmModule.forRootAsync({
  useFactory: (config) => ({
    type: 'postgres',
    host: config.get('POSTGRES_HOST') ?? 'localhost',
    port: parseInt(config.get('POSTGRES_TEST_PORT') ?? '5433'),
    database: config.get('POSTGRES_TEST_DB') ?? 'waiona_test',
    synchronize: true,   // recrea el schema automáticamente
    dropSchema: true,    // destruye y recrea el schema al iniciar
  }),
})
```

`dropSchema: true` es la clave: cada archivo e2e empieza con una DB vacía y fresca. Esto garantiza aislamiento entre tests pero implica que:

1. Los tests de un mismo archivo comparten estado (orden importa dentro del `describe`).
2. Los archivos e2e no pueden correr en paralelo sobre la misma DB (por eso `maxWorkers: 1`).

Los servicios externos que no se quieren testear (como el mail) se mockean:

```typescript
const mockMailService = {
  sendActivationEmail: jest.fn().mockResolvedValue(undefined),
};
// ...
.overrideProvider(MailService).useValue(mockMailService)
```

---

## Pipeline de CI — GitHub Actions

Archivo: `.github/workflows/ci.yml`

Se dispara en:
- `push` a `master`
- `pull_request` hacia `master`

### Estructura de Jobs

```
lint ──────────────────────────────────┐
                                       ├──→ test-e2e
test-unit ─────────────────────────────┤
                                       │
build ─────────────────────────────────┘
```

Los tres primeros jobs corren **en paralelo** (no tienen `needs`). El job `test-e2e` tiene `needs: [lint, test-unit, build]` — espera que los tres pasen antes de ejecutarse.

### Job: lint

```yaml
- run: npx eslint "{src,apps,libs,test}/**/*.ts"
```

Corre ESLint sobre todo el TypeScript del proyecto. Si hay errores de lint, el pipeline falla antes de llegar a los tests.

### Job: test-unit

```yaml
- run: npm test
```

Corre todos los `*.spec.ts` con Jest. No requiere DB ni Redis — todo está mockeado.

### Job: build

```yaml
- run: npm run build
```

Compila TypeScript con `nest build`. Verifica que el código compila sin errores de tipos.

### Job: test-e2e

Este es el más complejo. Usa **service containers** de GitHub Actions — containers Docker efímeros que GitHub levanta para el job y destruye al terminar:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_DB: waiona_test
      POSTGRES_USER: waiona_user
      POSTGRES_PASSWORD: waiona_pass
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
```

Los service containers arrancan **antes** de que corran los steps del job, y GitHub espera a que los healthchecks pasen. El código de tests se conecta a `localhost:5432` (no a `postgres:5432`) porque los ports están mapeados al runner.

Las variables de entorno del job inyectan la configuración:

```yaml
env:
  POSTGRES_HOST: localhost
  POSTGRES_PORT: 5432        # mismo puerto que local, pero CI solo tiene una DB
  POSTGRES_TEST_DB: waiona_test
  POSTGRES_TEST_PORT: 5432   # ← en CI no hay puerto 5433, todo va al mismo postgres
  JWT_SECRET: ci-jwt-secret-not-for-production
  RESEND_API_KEY: ci-resend-key   # valor falso — mail está mockeado en los tests
  # ... etc.
```

Finalmente corre: `npm run test:e2e` — Jest lee `test/jest-e2e.json`, encuentra todos los `*.e2e-spec.ts`, y los corre en serie (`maxWorkers: 1`).

### Cache de npm

Todos los jobs usan:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
    cache: 'npm'
```

`cache: 'npm'` cachea `~/.npm` entre runs usando `package-lock.json` como key. Si el lock file no cambió, `npm ci` restaura desde cache en segundos en vez de descargar todo.

---

## Diferencias entre Local y CI

| Aspecto | Local | CI |
|---|---|---|
| DB de tests | `postgres_test` en puerto 5433 | `postgres` service container en 5432 |
| `POSTGRES_TEST_PORT` | `5433` | `5432` |
| Infraestructura | docker-compose | Service containers efímeros |
| Redis | Servicio persistente | Service container efímero |
| DB principal | `postgres` en puerto 5432 | No existe (no hace falta en CI) |
| API dockerizada | `docker-compose up api` | No se levanta como container en CI |

En CI no existe la `api` como container — Jest levanta la app en memoria usando `Test.createTestingModule()`.

---

## Lo que queda colgado / pendiente

### Sin CD (Continuous Deployment)

El CI solo verifica — no despliega. Cuando el pipeline pasa en `master`, no hay ningún job que construya la imagen Docker y la suba a un registry ni que la despliegue a ningún servidor. El deploy es hoy un proceso manual.

**Lo que faltaría para tener CD completo:**

```yaml
deploy:
  needs: [test-e2e]
  if: github.ref == 'refs/heads/master'
  steps:
    - run: docker build -t waiona-api:${{ github.sha }} .
    - run: docker push <registry>/waiona-api:${{ github.sha }}
    # + step para actualizar el server (SSH, Railway, Fly.io, etc.)
```

### Sin test de la imagen Docker

El CI nunca hace `docker build` para verificar que el Dockerfile funciona. Solo corre `npm run build` (el transpilador). Una rotura en el Dockerfile o en el `entrypoint.sh` pasaría el CI sin ser detectada.

**Fix simple:** agregar un step en el job `build` o uno nuevo:

```yaml
- run: docker build -t waiona-api:test .
```

### `postgres_test` en docker-compose sin uso desde la API

El servicio `postgres_test` en docker-compose existe para los tests locales, pero el servicio `api` no lo referencia. Si alguien levanta solo `docker-compose up api`, `postgres_test` no arranca (está bien — no hace falta para la API). Solo arranca si se hace `docker-compose up` completo o se llama explícitamente. Está bien diseñado, pero puede generar confusión.

### Redis sin volumen en docker-compose

```yaml
redis:
  image: redis:7-alpine
  # sin volumes declarado
```

Los datos de Redis (jobs de BullMQ en cola, cache) se pierden cada vez que el container de Redis se reinicia. Para desarrollo es aceptable, pero si hay jobs de mail en cola al momento de reiniciar, se pierden silenciosamente. Las alertas de stock crítico del BullMQ también se perderían.

Si se quiere persistir: agregar `redis_data` a los volumes del compose y montarlo en `/data` con `command: redis-server --appendonly yes`.

### `maxWorkers: 1` — tests e2e siempre seriales

Los e2e tests corren de a uno por el `maxWorkers: 1` en `jest-e2e.json`. Esto es necesario porque todos los specs usan `dropSchema: true` sobre la misma DB — si corrieran en paralelo se pisarían mutuamente. Con ~25 archivos e2e, esto puede volverse lento a medida que crece la suite.

La solución a largo plazo sería que cada spec use una DB separada (schemas de Postgres distintos) para poder paralelizarlos, pero requiere más trabajo de setup.

### Sin lint en el watch de CI

Si se pushea a una rama y se abre PR, el CI corre en el PR. Pero no hay ningún check que impida mergear si el CI está fallando — eso se configura en GitHub en `Settings → Branches → Branch protection rules → Require status checks`. Sin esa configuración, el CI es informativo pero no bloqueante.

---

## Flujo completo de extremo a extremo

```
Developer hace push a rama →
  GitHub Actions dispara CI →
    [paralelo]
      lint: eslint sobre todo el TS
      test-unit: jest sobre *.spec.ts (sin DB)
      build: nest build (compila a dist/)
    [si los 3 pasan]
      test-e2e:
        GitHub levanta postgres:15 + redis:7 como service containers
        npm ci (restaura desde cache si no cambió package-lock.json)
        npm run test:e2e → Jest corre cada *.e2e-spec.ts en serie:
          cada spec: dropSchema + synchronize + tests reales con supertest
        service containers se destruyen al terminar el job
  CI pasa/falla → GitHub muestra estado en el PR

[si merge a master]
  → no hay deploy automático (manual hoy)
  → en producción: docker build + push + deploy manual
  → container arranca: entrypoint.sh corre migraciones → node dist/main
```
