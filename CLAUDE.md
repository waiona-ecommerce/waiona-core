# Waiona Core — Contexto del Proyecto

## ¿Qué es este proyecto?
API REST backend para **Waiona**, una plataforma de e-commerce/delivery. Desarrollada con **NestJS + TypeScript + PostgreSQL + TypeORM**.

El sistema permite a clientes ver productos, hacer pedidos y pagar con MercadoPago. Los administradores gestionan el catálogo, stock, precios, descuentos, cupones e impuestos.

---

## Stack Técnico

| Tecnología | Versión / Detalle |
|---|---|
| Runtime | Node.js |
| Framework | NestJS |
| Lenguaje | TypeScript |
| ORM | TypeORM |
| Base de datos | PostgreSQL |
| Autenticación | JWT + Passport (local + jwt strategy) |
| Email | Resend (SDK oficial) |
| Pagos | MercadoPago SDK |
| Tests | Jest |
| Validación | class-validator + class-transformer |

---

## Estructura de Módulos

```
src/
├── common/
│   ├── decorators/roles.decorator.ts     → @Roles(RoleType.ADMIN)
│   ├── decorators/current-user.decorator.ts → @CurrentUser() — extrae JwtPayload del JWT
│   ├── entities/base.entity.ts           → id, createdAt, updatedAt, isDeleted
│   ├── entities/base.audit.entity.ts     → sin isDeleted, solo auditoría
│   ├── enums/currency-code.enum.ts
│   ├── enums/role-type.enum.ts           → SUPER_ADMIN | ADMIN | CLIENT
│   ├── guards/roles.guard.ts             → lee rol del JWT payload, sin DB query
│   ├── guards/guards.module.ts
│   ├── cache/                            → (vacío — cache manejado vía @nestjs/cache-manager en controllers)
│   ├── interceptors/idempotency.interceptor.ts → previene POST duplicados (clave = hash del body)
│   └── theme/email-theme.ts             → colores y logo para templates de email
│
├── modules/
│   ├── auth/                             → login, register, activate, refresh, logout, change-password, forgot/reset password
│   │   └── entities/refresh-token.entity.ts → refresh tokens (guardado como hash, rotation implementada)
│   ├── users/                            → CRUD usuarios, búsqueda por email/nombre
│   ├── seed/                             → crea roles base y superadmin al arrancar
│   ├── mail/                             → cola BullMQ + Resend para envío asíncrono
│   │   ├── entities/token.entity.ts      → tokens de activación y reset
│   │   └── templates/                   → HTML templates de email
│   ├── analytics/                        → dashboard admin: órdenes, top productos, stock crítico
│   ├── storage/                          → upload/delete de imágenes en Cloudinary
│   ├── products/
│   │   ├── product/                      → CRUD productos (requiere categoryId)
│   │   ├── combos/                       → CRUD combos (items + categoryId)
│   │   ├── categories/                   → árbol de categorías padre/hijo
│   │   ├── product-images/              → imágenes ordenadas por position (Cloudinary)
│   │   ├── combo-images/                → imágenes de combos (Cloudinary)
│   │   └── shop/                         → endpoints públicos para el cliente (GET /shop/categories cacheado con CacheInterceptor oficial)
│   ├── pricing/
│   │   ├── (product|combo)-pricing/     → precio base y margen
│   │   └── calculation/                 → motor de cálculo (prorrateo de impuestos en combos)
│   ├── taxation/
│   │   ├── taxes/                        → impuestos globales (siempre porcentuales)
│   │   ├── tax-types/                   → tipos de impuesto (IVA, IIBB, etc.)
│   │   └── product-taxes/               → impuestos específicos por producto (combos se prorratean)
│   ├── margins/                          → márgenes de ganancia (siempre porcentuales)
│   ├── discounts/
│   │   ├── discount/                     → descuentos con fechas y valor (siempre porcentuales)
│   │   ├── discount-product-target/     → descuento asignado a producto
│   │   └── discount-combo-target/       → descuento asignado a combo
│   ├── coupons/
│   │   ├── coupon/                       → códigos de cupón (siempre porcentuales — sin isPercentage/currency)
│   │   ├── coupon-product-target/       → cupón para producto específico
│   │   ├── coupon-combo-target/         → cupón para combo específico
│   │   └── usage/                        → registro de usos con transacción
│   ├── stocks/
│   │   ├── stock-item/                  → stock por producto+ubicación (sin stockMax)
│   │   ├── stock-locations/             → depósitos/ubicaciones
│   │   ├── stock-movement/             → log de movimientos (ENTRY/EXIT/etc.)
│   │   └── stock-writeoff/             → bajas por daño o ajuste
│   ├── orders/                           → creación y gestión de pedidos
│   ├── payments/                         → pagos con MercadoPago + webhook
│   └── database/                         → ormconfig (no utilizado actualmente)
```

---

## Roles y Permisos

| Rol | Descripción |
|---|---|
| `super_admin` | Acceso total. Creado por el seed al arrancar. |
| `admin` | Gestión del negocio — productos, stock, precios, órdenes. |
| `client` | Asignado automáticamente al registrarse. Puede ver shop, crear órdenes. |

El `RolesGuard` lee el rol directo del JWT payload (`{ sub, role }`) — sin queries a la DB.

---

## Flujo de Cálculo de Precios

```
unitPrice
  → aplicar descuento (discount)        → priceAfterDiscount
  → aplicar margen                      → priceAfterMargin
  → aplicar impuestos                   → finalPrice         ← precio real sin cupón
  → aplicar cupón (opcional)            → orderTotal         ← lo que paga el cliente

fullPrice = precio sin descuento (margen + impuestos sobre unitPrice) → para mostrar tachado en el front
```

---

## Flujo de una Orden

1. Cliente hace `POST /orders` con items (productId o comboId) y deliveryType
2. Se calcula precio con `CalculationService`
3. Se reserva stock con `StockItemsService.reserveStock()`
4. Se valida y registra el cupón si viene (transacción atómica)
5. Admin hace `PATCH /orders/:id/status` para avanzar el estado
6. Al despachar (`DISPATCHED`) → se descuenta stock real con `dispatchStock()`
7. Al cancelar (`CANCELLED`) → se libera reserva con `releaseReservation()`

**Transiciones de estado válidas:**
```
PENDING → CONFIRMED | CANCELLED
CONFIRMED → DISPATCHED | CANCELLED
DISPATCHED → DELIVERED
DELIVERED → (ninguna)
CANCELLED → (ninguna)
```

---

## Flujo de Auth

```
POST /v1/auth/register          → crea usuario inactivo → envía email de activación
GET  /v1/auth/activate          → activa la cuenta con token
POST /v1/auth/login             → valida credenciales + isActive → devuelve access_token + refresh_token
POST /v1/auth/refresh           → rota refresh token → nuevos access_token + refresh_token
POST /v1/auth/logout            → revoca refresh token (logout de un dispositivo)
POST /v1/auth/logout-all        → revoca todos los refresh tokens del usuario (JWT requerido)
PATCH /v1/auth/change-password  → cambia contraseña validando la actual (JWT requerido)
POST /v1/auth/forgot-password   → envía email de reset
POST /v1/auth/reset-password    → valida token y cambia password
```

JWT payload: `{ sub: userId, role: RoleType }`

---

## Convenciones del Proyecto

### Entidades
- Todas extienden `BaseEntity` (`id`, `createdAt`, `updatedAt`, `deletedAt` via `@DeleteDateColumn`)
- Soft delete: `repo.softDelete(id)` — TypeORM aplica `deletedAt IS NULL` automáticamente en `find*` y QueryBuilder
- Snake_case en columnas de DB, camelCase en TypeScript
- `@BeforeInsert` en `UserEntity` hashea la password automáticamente

### Services
- Siempre devolver DTOs de respuesta, nunca la entidad directa
- Métodos privados `findOne/findEntity` para reutilizar la lógica de búsqueda + NotFoundException
- Transacciones con `dataSource.transaction()` cuando se tocan múltiples tablas

### Controllers
- Guards a nivel de clase cuando todos los endpoints requieren el mismo acceso
- `@Roles()` + `@UseGuards(AuthGuard('jwt'), RolesGuard)` para endpoints de admin
- Rutas específicas (ej: `GET /user/:userId`) siempre ANTES de rutas genéricas (ej: `GET /:id`)
- `@CurrentUser() user: JwtPayload` para leer el usuario autenticado — nunca `@Req() req: any`

### DTOs
- `class-validator` para validación
- `@Type(() => Number)` en query params numéricos (el ValidationPipe tiene `transform: true`)
- `PartialType` para update DTOs
- Normalización de strings con `@Transform` de `class-transformer`:
  - Identificadores de negocio (`name`, `code`, `sku`) → `value?.toUpperCase().trim()`
  - Texto libre (`description`, `address`, `notes`) → `value?.trim()`
  - URLs, emails, passwords → sin `@Transform`

### Tests
- Unit tests con mocks del repositorio (sin DB real)
- Factory functions `mockEntity(overrides = {})` para datos de prueba
- `jest.clearAllMocks()` en `afterEach`
- `overrideGuard` para saltar autenticación en controller specs
- En controller specs, pasar `{ sub: 1, role: RoleType.CLIENT }` directo donde va `@CurrentUser()` — el decorator no se ejecuta en unit tests

---

## Variables de Entorno

```properties
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
JWT_SECRET=
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_NOTIFICATION_URL=
MP_WEBHOOK_SECRET=
FRONTEND_URL=
RESEND_API_KEY=
MAIL_FROM=
API_URL=
```

---

## Comandos Útiles

```bash
# Desarrollo
npm run start:dev

# Tests
npx jest
npx jest --testPathPattern="orders"
npx jest --coverage

# Build
npm run build

# Migraciones (requiere DB disponible)
npm run migration:generate -- src/database/migrations/NombreCambio  # genera desde cambios en entidades
npm run migration:run                                                # aplica en dev
npm run migration:run:prod                                           # aplica en prod (usa dist/)
```

---

## Notas Importantes

- `synchronize: true` está activo en desarrollo (`NODE_ENV !== 'production'`) — TypeORM sincroniza el schema automáticamente. En producción usa migraciones (`npm run migration:run:prod`) — el `entrypoint.sh` las corre automáticamente al arrancar el contenedor.
- El logo del email (`EMAIL_THEME.logo`) apunta a `API_URL/email/logo.png`. En desarrollo usar Cloudinary u otra URL pública.
- El webhook de MercadoPago siempre debe responder 200 — el service swallow errores internamente.
- `forbidNonWhitelisted: true` en el `ValidationPipe` — campos extra en el body generan 400.

---

## Memory Protocol (Engram)

Tenés acceso a memoria persistente entre sesiones via MCP tools (`mem_save`, `mem_search`, `mem_context`, `mem_session_summary`, etc.).

**Al iniciar cualquier sesión:**
- Llamar `mem_context` para recuperar el estado de trabajo anterior antes de arrancar

**Guardar proactivamente después de:**
- Bugfixes completados
- Decisiones de arquitectura o diseño técnico no obvias
- Descubrimientos importantes sobre el codebase
- Patrones o convenciones establecidas en esta sesión

**Antes de cerrar cualquier sesión:**
- Llamar `mem_session_summary` con: goal, accomplished, next steps, relevant files, next spec number
- Esto es obligatorio — sin este paso la próxima sesión arranca sin contexto

**Formato de mem_save:**
- `title`: verbo + qué (ej: "Corregir soft delete en categorías padre")
- `type`: `bugfix` | `architecture` | `decision` | `discovery` | `pattern`
- `topic_key`: `<tipo>/<módulo>-<aspecto>` para decisiones que evolucionan
- `content`: **What** / **Why** / **Where** / **Learned**