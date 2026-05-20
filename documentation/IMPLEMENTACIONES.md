# Implementaciones Pendientes — Roadmap hacia Producción

Ordenadas de menor a mayor complejidad. Los bloques respetan dependencias entre sí.

---

## Bloque 1 — Cambios rápidos, sin tocar arquitectura ✅ COMPLETO

### ~~1. Max en paginación~~ ✅
**Archivo:** `src/common/dto/pagination-query.dto.ts`  
Ya existía — `@Max(100)` presente en el campo `limit`.

### ~~2. Compresión de respuestas~~ ✅
**Archivo:** `src/main.ts`  
`compression` instalado. `app.use(compression())` agregado antes de `helmet()`.

### ~~3. `select: false` en password~~ ✅
**Archivo:** `src/modules/users/entities/user.entity.ts`  
`select: false` agregado al `@Column()` del campo `password`. Defensa en profundidad a nivel ORM junto al `@Exclude()` existente.

### ~~4. Rate limit específico en endpoints de auth~~ ✅
**Archivo:** `src/modules/auth/controllers/auth.controller.ts`  
Ya existía — `@Throttle` en `register` (5/min), `login` (5/min), `forgot-password` (3/min), `reset-password` (5/min).

### ~~5. Validación de variables de entorno al arrancar~~ ✅
**Archivo:** `src/app.module.ts`  
`joi` instalado. `validationSchema` agregado en `ConfigModule.forRoot()` con las 11 vars críticas.

---

## Bloque 2 — Independientes, sin dependencias entre sí ✅ COMPLETO

### ~~6. Índices de DB faltantes~~ ✅
- `orders`: `@Index(['userId', 'status'])` agregado — las demás entidades ya tenían sus índices
- `products`: ya tenía `name`, `isActive`, `sku` (unique), `categoryId`
- `coupons`: `code` tiene `unique: true` (índice implícito), `startsAt` y `endsAt` ya indexados
- `discount_product_targets` / `discount_combo_targets`: ya tenían `discountId` y `productId`/`comboId`
- `payments`: ya tenía `orderId` y `externalId`

### ~~7. Correlation IDs (Request ID)~~ ✅
- `src/common/context/request-context.ts` — `AsyncLocalStorage` con helper `getRequestId()`
- `src/common/middleware/request-id.middleware.ts` — genera UUID si no viene en header, lo setea en request y respuesta como `X-Request-Id`
- Registrado en `app.module.ts` via `NestModule.configure()`

### ~~8. Logging estructurado~~ ✅
- `nestjs-pino` + `pino-http` + `pino-pretty` instalados
- `LoggerModule.forRoot()` en `app.module.ts` con `customProps` que incluye `requestId`
- `app.useLogger(app.get(Logger))` en `main.ts` — todos los logs usan pino
- `GlobalExceptionFilter` loggea `error.stack` para errores 500+
- Dev: `pino-pretty` con `singleLine: true`. Prod: JSON puro

### ~~9. Health check real~~ ✅
- `src/modules/health/health.module.ts` + `health.controller.ts` creados
- `GET /health` → verifica DB (`TypeOrmHealthIndicator`), heap (<250MB) y disco (<90%)
- `503` si algún check falla, `200` si todo ok
- `HealthModule` importado en `app.module.ts`

### ~~10. Notificaciones de órdenes por email~~ ✅
- 4 templates creados: `order-confirmed`, `order-dispatched`, `order-cancelled`, `order-delivered`
- 4 métodos agregados a `MailService`
- `MailModule` importado en `OrdersModule`
- `MailService` inyectado en `OrdersService` — `sendStatusEmail()` privado, fire-and-forget tras el commit de la transacción

---

## Bloque 3 — Infraestructura ✅ COMPLETO

### ~~11. Dockerfile + docker-compose para la app~~ ✅
- `Dockerfile` multi-stage creado: `builder` (instala deps + compila) → `runner` (solo `dist/` + prod deps)
- `docker-compose.yaml` ya existía completo — tiene `postgres`, `postgres_test`, `pgadmin` y servicio `api` con `build: .`
- `.dockerignore` creado
- `NODE_ENV=production` en el runner — `synchronize` queda desactivado automáticamente

### ~~12. CI/CD — GitHub Actions~~ ✅
- `.github/workflows/ci.yml` creado
- Pipeline: `lint` + `test-unit` + `build` en paralelo → `test-e2e` (bloqueado hasta que los 3 pasen)
- E2E corre con postgres service container de GitHub Actions (no necesita Docker-in-Docker)
- `node_modules` cacheado via `actions/setup-node` con `cache: 'npm'`

### ~~13. Migraciones en producción~~ ✅
- `ormconfig.ts`: paths ahora condicionales — dev usa `src/**/*.entity.ts`, prod usa `dist/**/*.entity.js` (detecta por extensión de `__filename`)
- `entrypoint.sh` creado — corre `typeorm migration:run -d dist/database/ormconfig.js` antes de arrancar la app
- `migration:run:prod` agregado a `package.json` — usa el JS compilado directamente
- `synchronize` ya estaba condicionado a `process.env.NODE_ENV !== 'production'` ✅

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
