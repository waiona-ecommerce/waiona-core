# Implementaciones Pendientes — Roadmap hacia Producción

Ordenadas de menor a mayor complejidad. Los bloques respetan dependencias entre sí.

---

## Bloque 1 — Cambios rápidos, sin tocar arquitectura (~30 min total)

Hacerlos todos juntos de una sola vez.

### 1. Max en paginación
**Archivo:** `src/common/dto/pagination-query.dto.ts`  
Agregar `@Max(100)` en el campo `limit`. Sin esto un request `?limit=100000` ejecuta una query sin límite real.

### 2. Compresión de respuestas
**Archivo:** `src/main.ts`  
Instalar `compression` y agregar `app.use(compression())` antes del resto de middlewares. Reduce el tamaño de respuestas JSON un 60-80%.
```bash
npm install compression && npm install -D @types/compression
```

### 3. `select: false` en password
**Archivo:** `src/modules/users/entities/user.entity.ts`  
Agregar `select: false` al `@Column()` del campo `password`. El `@Exclude()` ya existe pero solo funciona con el interceptor. `select: false` es defensa en profundidad a nivel ORM.

### 4. Rate limit específico en endpoints de auth
**Archivo:** `src/modules/auth/controllers/auth.controller.ts`  
Agregar `@Throttle({ default: { limit: 5, ttl: 60000 } })` en:
- `POST /auth/login` — previene brute force
- `POST /auth/forgot-password` — previene spam de emails
- `POST /auth/register` — previene creación masiva de cuentas

### 5. Validación de variables de entorno al arrancar
**Archivo:** `src/app.module.ts`  
Instalar `joi` y agregar `validationSchema` en `ConfigModule.forRoot()`. Si falta una env var crítica, la app no arranca (falla rápido, no en producción).
```bash
npm install joi
```
Variables a validar: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`, `RESEND_API_KEY`, `FRONTEND_URL`, `API_URL`.

---

## Bloque 2 — Independientes, sin dependencias entre sí (~medio día cada uno)

El ítem 8 (logging) conviene hacerlo después del 7 (correlation IDs).

### 6. Índices de DB faltantes
**Archivos:** entidades sin `@Index`  
Auditar las 8 entidades sin índices. Índices prioritarios:
- `orders`: `(userId, status)` — usado en `GET /orders/user/:userId`
- `products`: `(categoryId, isDeleted)` — listados del shop
- `coupons`: `(code)` — búsqueda por código en creación de orden
- `discount_product_target` / `discount_combo_target`: `(productId/comboId, startsAt, endsAt)` — CalculationService busca descuentos activos por fecha
- `payments`: `(orderId)` — ya tiene `@Index`, verificar que esté en la entidad

### 7. Correlation IDs (Request ID)
**Archivo nuevo:** `src/common/middleware/request-id.middleware.ts`  
Middleware que genera un UUID por request, lo agrega al `AsyncLocalStorage` (o `cls-hooked`) y lo devuelve en el header `X-Request-Id`. Permite filtrar todos los logs de un request específico.
```bash
npm install uuid && npm install -D @types/uuid
```

### 8. Logging estructurado
**Librería:** `nestjs-pino` + `pino-pretty` (dev) + `pino` (prod)  
```bash
npm install nestjs-pino pino-http && npm install -D pino-pretty
```
- Reemplazar logs de consola por `Logger` de `nestjs-pino`
- Loggear cada request: método, path, status code, duración
- El `GlobalExceptionFilter` debe hacer `logger.error(exception)` antes de responder
- En desarrollo: output legible con `pino-pretty`. En producción: JSON puro para ingestar en Datadog/CloudWatch/Loki
- Incluir el `requestId` del paso 7 en cada log

### 9. Health check real
**Librería:** `@nestjs/terminus`  
```bash
npm install @nestjs/terminus
```
- Crear `src/modules/health/health.module.ts` con `HealthController`
- `GET /health` → verifica DB con `TypeOrmHealthIndicator`, memoria heap, y disco
- Responde `200` si todo ok, `503` si algo falla
- Reemplaza el `GET /` actual que solo devuelve `{ status: 'ok' }` hardcodeado

### 10. Notificaciones de órdenes por email
**Archivos:** `src/modules/mail/`, `src/modules/orders/services/orders.service.ts`  
El `MailModule` ya existe con templates. Agregar emails en `updateStatus()`:
- `CONFIRMED` → "Tu pedido fue confirmado"
- `DISPATCHED` → "Tu pedido está en camino"
- `CANCELLED` → "Tu pedido fue cancelado"
- `DELIVERED` → "¿Cómo fue tu experiencia?"

---

## Bloque 3 — Infraestructura (~1 día cada uno)

El Dockerfile (11) desbloquea CI/CD (12) y migraciones (13).

### 11. Dockerfile + docker-compose para la app
**Archivos nuevos:** `Dockerfile`, `docker-compose.yml` (dev completo)  
- Dockerfile multi-stage: `builder` (instala deps + compila TS) → `runner` (solo `dist/` + `node_modules` de prod)
- `docker-compose.yml` que levante: `app` + `postgres` + `pgadmin`
- `docker-compose.test.yml` ya existe para e2e — integrarlo
- Variable `NODE_ENV=production` en el runner para desactivar `synchronize`

### 12. CI/CD — GitHub Actions
**Archivo nuevo:** `.github/workflows/ci.yml`  
Pipeline: `lint → test:unit → build → test:e2e (con Docker)`  
- Bloquear merge a `master` si falla algún paso
- Cachear `node_modules` entre runs
- Depende del Dockerfile del paso 11 para el job de e2e

### 13. Migraciones en producción
**Archivos:** `src/database/ormconfig.ts`, `package.json`  
- Los scripts de migración ya están en `package.json` pero `ormconfig.ts` no está configurado
- Configurar `ormconfig.ts` apuntando a las mismas env vars que `app.module.ts`
- En el entrypoint de producción: correr `migration:run` antes de `node dist/main`
- Desactivar `synchronize: true` definitivamente (ya está condicionado a `!== 'production'`, verificar que sea así en el deploy)

---

## Bloque 4 — Features de sesión (~1 día)

### 14. Refresh tokens
**Archivos nuevos:** entidad `RefreshTokenEntity`, endpoints en `auth.controller.ts`  
- `RefreshTokenEntity`: `{ id, userId, token (hash), expiresAt, revokedAt }`
- Al hacer login: generar access token (15min) + refresh token (7 días), guardar hash en DB
- `POST /auth/refresh` — valida refresh token, emite nuevo access token
- `POST /auth/logout` — revoca el refresh token en DB
- Permite "cerrar sesión en todos los dispositivos" (revocar todos los tokens del usuario)
- No requiere Redis

---

## Bloque 5 — Redis (hacerlos juntos, comparten infraestructura)

Instalar Redis una vez y usarlo para los 4 items.

```bash
npm install @nestjs/bull bull redis @nestjs/cache-manager cache-manager cache-manager-redis-yet ioredis
```

### 15. Idempotency key en `POST /orders`
**Archivos:** `src/modules/orders/`  
- Cliente genera UUID y lo manda en header `Idempotency-Key`
- Middleware o guard guarda `(userId, idempotencyKey)` en Redis con TTL 24h
- Si llega el mismo key: retorna la respuesta cacheada (409 o la orden original)
- Previene órdenes duplicadas por doble-click o retry de red

### 16. Email en cola (BullMQ)
**Archivos:** `src/modules/mail/`  
- `MailModule` encola el trabajo en vez de llamar a Resend directamente
- Worker separado procesa la cola con reintentos automáticos (3 intentos, backoff exponencial)
- El flujo de registro responde en <50ms independientemente de si Resend está lento

### 17. Alertas de stock
**Archivos:** `src/modules/stocks/stock-item/services/stock-item.service.ts`  
- Hook al final de `dispatchStock()`: si `quantityAvailable <= stockCritical` → encolar notificación al admin (usa la cola del paso 16)
- Email al admin: "Stock crítico: Producto X tiene solo N unidades disponibles en Depósito Y"

### 18. Cache del shop con Redis
**Archivos:** `src/modules/products/shop/services/shop.service.ts`  
- Cachear respuestas de `search()` y `findById()` con TTL de 60 segundos
- Invalidar cache cuando cambia pricing, discounts o taxes (hook en los respectivos services)
- Mayor impacto en el listado del shop que es el endpoint más llamado

---

## Bloque 6 — Refactor transversal (cuando la API esté estable)

### 19. API versioning
**Archivos:** `src/main.ts` + todos los controllers  
- `app.enableVersioning({ type: VersioningType.URI })` en `main.ts`
- Cada controller: `@Controller({ version: '1', path: 'resource' })`
- Todas las rutas quedan bajo `/v1/resource`
- Hacerlo último porque toca todos los controllers y puede romper clientes existentes

---

## Resumen de tiempos estimados

| Bloque | Items | Tiempo total |
|---|---|---|
| 1 — Cambios rápidos | 1-5 | ~30 min |
| 2 — Independientes | 6-10 | ~2-3 días |
| 3 — Infraestructura | 11-13 | ~2-3 días |
| 4 — Refresh tokens | 14 | ~1 día |
| 5 — Redis | 15-18 | ~2-3 días |
| 6 — Versioning | 19 | ~1 día |
