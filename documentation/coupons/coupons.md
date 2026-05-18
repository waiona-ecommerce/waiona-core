# Coupons — Análisis Técnico Completo

## ¿Qué es un cupón?

Un cupón es un **código promocional que el cliente ingresa al momento de hacer un pedido** para obtener un descuento sobre el total de la orden. A diferencia de los descuentos, que se aplican automáticamente sobre el precio del producto, el cupón actúa al final de la cadena de cálculo y requiere que el cliente lo ingrese explícitamente.

```
unitPrice
  → aplicar descuento        → priceAfterDiscount
  → aplicar margen           → priceAfterMargin
  → aplicar impuestos        → finalPrice            ← precio sin cupón (fullPrice para mostrar)
  → aplicar cupón (opcional) → orderTotal            ← acá actúa este módulo
```

Un cupón puede ser **global** (aplica a cualquier producto o combo del catálogo) o **dirigido** (aplica solo a los productos y/o combos que el admin le asigna). Además puede tener un límite de usos, fechas de vigencia y restricción de un uso por usuario.

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Campaña de marketing | "BIENVENIDO10" — 10% off para nuevos usuarios |
| Promoción puntual | "VERANO500" — $500 off sobre productos seleccionados |
| Cupón con límite | "FLASH20" — 20% off, solo 100 usos disponibles |
| Cupón de temporada | "NAVIDAD15" — activo del 20 al 31 de diciembre |
| Cupón global | "TOTALOFF5" — 5% off sobre cualquier producto del catálogo |

---

## Estructura del módulo

```
coupons/
├── coupon/                    → CRUD del cupón (código, valor, fechas, límite de uso)
├── coupon-product-target/    → asignación del cupón a productos específicos
├── coupon-combo-target/      → asignación del cupón a combos específicos
└── usage/                    → registro transaccional de usos con control de concurrencia
```

---

## Tipos de datos

### Entidad (`CouponEntity`)

```typescript
{
  id:           number;         // PK autoincremental
  code:         string;         // código único, 3–100 chars, case-sensitive
  value:        number;         // decimal(10,2) — viene como string de PG, convertido en DTO
  isPercentage: boolean;        // true = %, false = monto fijo
  currency?:    CurrencyCode;   // requerido si isPercentage = false, null si isPercentage = true
  isGlobal:     boolean;        // true = aplica a todo, false = requiere targets asignados
  usageLimit?:  number | null;  // int — null = sin límite
  usageCount:   number;         // int — se incrementa en la transacción de uso
  startsAt?:    Date | null;    // inicio de vigencia (opcional)
  endsAt?:      Date | null;    // fin de vigencia (opcional)
  deletedAt:    Date | null;    // soft delete vía @DeleteDateColumn
  createdAt:    Date;
  updatedAt:    Date;
}
```

### Enum `CouponStatus`

```typescript
enum CouponStatus {
  ACTIVE    = 'active',      // vigente ahora
  SCHEDULED = 'scheduled',   // aún no empezó (startsAt > now)
  EXPIRED   = 'expired',     // ya venció (endsAt < now) o endsAt < startsAt
  EXHAUSTED = 'exhausted',   // usageCount >= usageLimit
}
```

El status **no se persiste en la base de datos** — se calcula en tiempo real dentro de `CouponResponseDto.calculateStatus()`.

### Request: crear cupón (`CreateCouponDto`)

```typescript
{
  code:          string;        // requerido, 3–100 chars
  value:         number;        // requerido, min 0.01, max 2 decimales
  isPercentage:  boolean;       // requerido
  currency?:     CurrencyCode;  // requerido si isPercentage = false
  isGlobal:      boolean;       // requerido
  usageLimit?:   number;        // opcional, int, min 1
  startsAt?:     Date;          // opcional — ISO 8601
  endsAt?:       Date;          // opcional — ISO 8601
}
```

### Request: actualizar cupón (`UpdateCouponDto`)

Todos los campos son opcionales (`PartialType` de `CreateCouponDto`):

```typescript
{
  code?:          string;
  value?:         number;
  isPercentage?:  boolean;
  currency?:      CurrencyCode;
  isGlobal?:      boolean;
  usageLimit?:    number;
  startsAt?:      Date;
  endsAt?:        Date;
}
```

### Response: cupón (`CouponResponseDto`)

```typescript
{
  id:            number;
  code:          string;
  status:        CouponStatus;   // calculado en tiempo real
  value:         number;         // Number(entity.value) — fix decimal PG
  isPercentage:  boolean;
  currency?:     CurrencyCode;   // undefined si isPercentage = true
  isGlobal:      boolean;
  usageLimit?:   number;         // undefined si null en DB
  usageCount:    number;
  startsAt?:     Date;
  endsAt?:       Date;
  createdAt:     Date;
  updatedAt:     Date;
}
```

### Response: listado paginado (`PaginatedResponseDto<CouponResponseDto>`)

```typescript
{
  data:        CouponResponseDto[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
  hasNextPage: boolean;
}
```

### Entidad target de producto (`CouponProductTargetEntity`)

```typescript
{
  id:        number;
  couponId:  number;   // FK → coupon_id (CASCADE DELETE)
  productId: number;   // columna int simple, sin FK a products (validado en service)
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

> **Nota:** `(couponId, productId)` tiene unique constraint en DB (`@Index({ unique: true })`). La validación de existencia del producto se hace en el service antes de crear.

### Entidad target de combo (`CouponComboTargetEntity`)

```typescript
{
  id:        number;
  couponId:  number;   // FK → coupon_id (CASCADE DELETE)
  comboId:   number;   // columna int simple, sin FK a combos (validado en service)
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

> **Nota:** `(couponId, comboId)` tiene unique constraint en DB (`@Index({ unique: true })`).

### Entidad de uso (`CouponUsageEntity`)

```typescript
{
  id:        number;
  couponId:  number;   // FK → coupon_id (RESTRICT)
  userId:    number;   // FK → user_id (RESTRICT)
  orderId:   number;   // FK → order_id (RESTRICT)
  appliedAt: Date;     // timestamp — cuándo se aplicó el cupón
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

> **Índice único:** `(couponId, userId)` — un usuario solo puede usar cada cupón una vez.

### Response: target (`CouponProductTargetResponseDto` / `CouponComboTargetResponseDto`)

```typescript
{
  id:        number;
  couponId:  number;
  productId: number;   // o comboId según el tipo
  createdAt: Date;
  updatedAt: Date;
}
```

### Response: uso (`CouponUsageResponseDto`)

```typescript
{
  id:        number;
  couponId:  number;
  orderId:   number;
  userId:    number;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Endpoints

Todos los endpoints requieren JWT con rol `SUPER_ADMIN` o `ADMIN`.

---

### `POST /coupons`

Crea un nuevo cupón.

**Request:**
```json
{
  "code": "VERANO10",
  "value": 10,
  "isPercentage": true,
  "isGlobal": false,
  "usageLimit": 100,
  "startsAt": "2026-12-01T00:00:00.000Z",
  "endsAt": "2026-12-31T23:59:59.000Z"
}
```

**Response 201:**
```json
{
  "id": 1,
  "code": "VERANO10",
  "status": "scheduled",
  "value": 10,
  "isPercentage": true,
  "isGlobal": false,
  "usageLimit": 100,
  "usageCount": 0,
  "startsAt": "2026-12-01T00:00:00.000Z",
  "endsAt": "2026-12-31T23:59:59.000Z",
  "createdAt": "2026-05-18T10:00:00.000Z",
  "updatedAt": "2026-05-18T10:00:00.000Z"
}
```

**Errores posibles:**
- `400` — `startsAt >= endsAt`
- `400` — `isPercentage: true` con `value > 100`
- `400` — `isPercentage: false` sin `currency`
- `400` — `isPercentage: true` con `currency` enviada
- `409` — el código ya existe

---

### `GET /coupons?page=1&limit=20`

Lista paginada de cupones activos (no eliminados), orden descendente por `createdAt`.

**Query params** (opcionales):
```
page  → default: 1
limit → default: 20
```

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "code": "VERANO10",
      "status": "active",
      "value": 10,
      "isPercentage": true,
      "isGlobal": false,
      "usageCount": 45,
      "usageLimit": 100,
      "createdAt": "2026-05-18T10:00:00.000Z",
      "updatedAt": "2026-05-18T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "hasNextPage": false
}
```

---

### `GET /coupons/:id`

Obtiene un cupón por ID.

**Response 200:** `CouponResponseDto`

**Errores posibles:**
- `404` — no encontrado

---

### `PATCH /coupons/:id`

Actualización parcial. Solo se actualiza lo que se envía.

**Request:**
```json
{ "usageLimit": 200 }
```

**Response 200:** `CouponResponseDto` actualizado

**Errores posibles:**
- `400` — fechas inválidas o valor fuera de rango
- `404` — no encontrado
- `409` — el código ya existe en otro cupón

---

### `DELETE /coupons/:id`

Soft delete. El cupón queda marcado con `deletedAt` y deja de aparecer en listados.

**Response 204:** sin body

**Errores posibles:**
- `404` — no encontrado

---

### `POST /coupons/:couponId/targets/products`

Asigna un producto a un cupón. Solo válido si el cupón no es global (`isGlobal: false`).

**Request:**
```json
{ "productId": 5 }
```

**Response 201:**
```json
{
  "id": 1,
  "couponId": 1,
  "productId": 5,
  "createdAt": "2026-05-18T10:00:00.000Z",
  "updatedAt": "2026-05-18T10:00:00.000Z"
}
```

**Errores posibles:**
- `404` — cupón no encontrado
- `404` — producto no encontrado
- `409` — el cupón es global (no acepta targets)
- `409` — el producto ya está asignado a este cupón

---

### `GET /coupons/:couponId/targets/products`

Lista todos los productos asignados a un cupón.

**Response 200:** array de `CouponProductTargetResponseDto`

**Errores posibles:**
- `404` — cupón no encontrado

---

### `DELETE /coupons/:couponId/targets/products/:productId`

Quita un producto de un cupón (soft delete del target).

**Response 204:** sin body

**Errores posibles:**
- `404` — cupón no encontrado
- `404` — el producto no estaba asignado a este cupón

---

### `POST /coupons/:couponId/targets/combos`

Asigna un combo a un cupón. Solo válido si el cupón no es global.

**Request:**
```json
{ "comboId": 3 }
```

**Response 201:**
```json
{
  "id": 1,
  "couponId": 1,
  "comboId": 3,
  "createdAt": "2026-05-18T10:00:00.000Z",
  "updatedAt": "2026-05-18T10:00:00.000Z"
}
```

**Errores posibles:**
- `404` — cupón no encontrado
- `404` — combo no encontrado
- `409` — el cupón es global
- `409` — el combo ya está asignado a este cupón

---

### `GET /coupons/:couponId/targets/combos`

Lista todos los combos asignados a un cupón.

**Response 200:** array de `CouponComboTargetResponseDto`

**Errores posibles:**
- `404` — cupón no encontrado

---

### `DELETE /coupons/:couponId/targets/combos/:comboId`

Quita un combo de un cupón (soft delete del target).

**Response 204:** sin body

**Errores posibles:**
- `404` — cupón no encontrado
- `404` — el combo no estaba asignado a este cupón

---

### `POST /coupon-usage`

Registra el uso de un cupón en una orden. El `userId` se extrae del JWT — no se acepta en el body.

> **Uso principal:** este endpoint es llamado internamente por el módulo `Orders` al confirmar un pedido con cupón. El endpoint HTTP existe para registros manuales por parte de admins.

**Request:**
```json
{
  "code": "VERANO10",
  "orderId": 42
}
```

**Response 201:**
```json
{
  "id": 1,
  "couponId": 1,
  "orderId": 42,
  "userId": 7,
  "appliedAt": "2026-05-18T10:00:00.000Z",
  "createdAt": "2026-05-18T10:00:00.000Z",
  "updatedAt": "2026-05-18T10:00:00.000Z"
}
```

**Errores posibles:**
- `404` — cupón con ese código no encontrado
- `400` — el cupón aún no está activo (`startsAt` en el futuro)
- `400` — el cupón ya venció
- `400` — el límite de usos fue alcanzado
- `409` — el usuario ya usó este cupón

---

### `GET /coupon-usage?page=1&limit=20`

Lista paginada de todos los usos de cupones registrados.

**Response 200:** `PaginatedResponseDto<CouponUsageResponseDto>`

---

### `GET /coupon-usage/coupon/:couponId`

Lista todos los usos de un cupón específico.

**Response 200:** array de `CouponUsageResponseDto`

---

### `GET /coupon-usage/user/:userId`

Lista todos los cupones usados por un usuario específico.

**Response 200:** array de `CouponUsageResponseDto`

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| `startsAt` debe ser estrictamente menor que `endsAt` | `create` y `update` — `validateDates()` |
| Si `isPercentage: true` → `value ≤ 100` | `create` y `update` — `validateValue()` |
| Si `isPercentage: false` → `currency` requerida | `create` y `update` — `validateValue()` |
| Si `isPercentage: true` → `currency` se limpia automáticamente a `null` | `create` y `update` — `normalizeCoupon()` |
| El `code` debe ser único en toda la tabla | `create` y `update` — `validateUniqueCode()` |
| Cupones globales no pueden tener targets de producto o combo | `CouponProductTargetService` y `CouponComboTargetService` — `validateCouponNotGlobal()` |
| Un cupón no puede tener el mismo producto asignado dos veces | `CouponProductTargetService` — `validateUniqueTarget()` + unique index DB |
| Un cupón no puede tener el mismo combo asignado dos veces | `CouponComboTargetService` — `validateUniqueTarget()` + unique index DB |
| Un usuario solo puede usar cada cupón una vez | `CouponUsageService` — `alreadyUsed` check + unique index `(couponId, userId)` |
| Todo el flujo de uso ocurre dentro de una transacción con `pessimistic_write` | `CouponUsageService.create()` — previene race conditions en `usageCount` |
| `usageCount` se incrementa atómicamente dentro de la transacción | `CouponUsageService.create()` |
| `userId` proviene del JWT — no del body del request | `CouponUsageController.create()` — `req.user.sub` |
| `status` calculado en tiempo real — no persiste en DB | `CouponResponseDto.calculateStatus()` |
| Soft delete — `deletedAt` — TypeORM filtra `IS NULL` automáticamente | `remove()` — `repo.softDelete()` |

### Lógica de `calculateStatus()`

```
si endsAt < startsAt                                  → EXPIRED   (rango inválido)
si usageLimit != null && usageCount >= usageLimit     → EXHAUSTED (sin usos disponibles)
si now > endsAt                                       → EXPIRED   (venció)
si now < startsAt                                     → SCHEDULED (aún no empieza)
en cualquier otro caso                                → ACTIVE
```

Un cupón sin fechas ni límite de uso siempre devuelve `ACTIVE`.

### Flujo de uso con control de concurrencia

```
POST /coupon-usage (o llamada interna desde Orders)
  └── dataSource.transaction()
        ├── findOne(CouponEntity, { lock: 'pessimistic_write' })  ← bloquea la fila
        ├── validar fechas de vigencia
        ├── validar límite de uso (usageCount < usageLimit)
        ├── validar que el usuario no haya usado el cupón
        ├── crear CouponUsageEntity
        ├── coupon.usageCount += 1
        └── guardar ambos — atómico
```

---

## Ejemplos de uso real

**Crear cupón global sin límite:**
```json
POST /coupons
{
  "code": "WELCOME",
  "value": 5,
  "isPercentage": true,
  "isGlobal": true
}
```

**Crear cupón dirigido con límite de usos:**
```json
POST /coupons
{
  "code": "FLASH100",
  "value": 100,
  "isPercentage": false,
  "currency": "ARS",
  "isGlobal": false,
  "usageLimit": 50
}
```

**Asignar producto al cupón:**
```json
POST /coupons/2/targets/products
{ "productId": 7 }
```

**Registrar uso al confirmar orden:**
```json
POST /coupon-usage
{
  "code": "FLASH100",
  "orderId": 99
}
→ 201 (userId extraído del JWT)
```

**Segundo intento del mismo usuario — 409:**
```json
POST /coupon-usage
{
  "code": "FLASH100",
  "orderId": 100
}
→ 409 Conflict: "User has already used this coupon"
```

**Cupón global no acepta targets — 409:**
```json
POST /coupons/1/targets/products
{ "productId": 3 }
→ 409 Conflict: "Cannot assign targets to a global coupon"
```

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Entidades extienden `BaseEntity` con `@DeleteDateColumn` | ✅ |
| Soft delete vía `repo.softDelete(id)` | ✅ |
| TypeORM filtra `deletedAt IS NULL` automáticamente | ✅ |
| Services retornan DTOs, nunca entidades | ✅ |
| `ParseIntPipe` en todos los params de ID | ✅ |
| Guards a nivel de clase en los cuatro controllers | ✅ |
| `PartialType` de `@nestjs/mapped-types` en `UpdateCouponDto` | ✅ |
| `Number(entity.value)` en `CouponResponseDto` — fix decimal de PG | ✅ |
| `@HttpCode(204)` en todos los DELETE | ✅ |
| `status` calculado en DTO, no persiste en DB | ✅ |
| `normalizeCoupon()` limpia `currency` cuando `isPercentage = true` | ✅ |
| `validateDates()` usa `>=` para bloquear rango vacío | ✅ |
| `userId` extraído del JWT — no aceptado desde el body | ✅ |
| Transacción con `pessimistic_write` en uso de cupón | ✅ |
| Unique index en DB para `(couponId, productId)` y `(couponId, comboId)` | ✅ |
| Unique index en DB para `(couponId, userId)` en usages | ✅ |
| Unit tests — service y controller, 8 suites, 64 tests | ✅ |
| E2E tests — PostgreSQL real, `dropSchema: true`, 36 tests | ✅ |
| Swagger — `@ApiTags`, `@ApiOperation`, `@ApiResponse` en los 4 controllers | ✅ |
| Swagger — `@ApiProperty` en todos los DTOs | ✅ |

---

## Tests

### Unit tests (`src/modules/coupons/`)

```bash
npx jest --testPathPattern="coupons" --no-coverage
```

| Suite | Tests | Cobertura |
|---|---|---|
| `coupon/services/coupon.service.spec.ts` | 15 | create (validaciones), findAll paginado, findOne, update, remove |
| `coupon/controllers/coupon.controller.spec.ts` | 10 | delegación a service, paginación, propagación de errores |
| `coupon-product-target/services/coupon-product-target.service.spec.ts` | 10 | create + conflictos + NotFoundException producto, findAll, remove |
| `coupon-product-target/controllers/coupon-product-target.controller.spec.ts` | 7 | delegación a service |
| `coupon-combo-target/services/coupon-combo-target.service.spec.ts` | 10 | create + conflictos + NotFoundException combo, findAll, remove |
| `coupon-combo-target/controllers/coupon-combo-target.controller.spec.ts` | 7 | delegación a service |
| `usage/services/coupon-usage.service.spec.ts` | 10 | create con transacción, findAll, findByCoupon, findByUser, errores |
| `usage/controllers/coupon-usage.controller.spec.ts` | 5 | delegación, userId extraído del JWT |

### E2E tests (`test/coupons/coupons.e2e-spec.ts`)

```bash
# Requiere Docker con la DB de test corriendo (puerto 5433)
docker compose up -d
npx jest --config test/jest-e2e.json --testPathPattern="coupons"
```

| Caso | Status code esperado |
|---|---|
| POST cupón porcentual | 201 — status: active |
| POST cupón con usageLimit y fechas | 201 — status: active |
| POST body vacío | 400 |
| POST porcentaje > 100 | 400 |
| POST cupón fijo sin currency | 400 |
| POST porcentaje con currency | 400 |
| POST startsAt posterior a endsAt | 400 |
| POST código duplicado | 409 |
| GET paginado | 200 — data[], total, page |
| GET con limit=1 | 200 — data con 1 elemento |
| GET por id existente | 200 |
| GET por id inexistente | 404 |
| PATCH actualiza usageLimit | 200 |
| PATCH código ya usado por otro cupón | 409 |
| PATCH id inexistente | 404 |
| DELETE exitoso | 204 |
| GET tras DELETE | 404 |
| DELETE id inexistente | 404 |
| POST product target — asignar | 201 |
| POST product target — duplicado | 409 |
| POST product target — cupón global | 409 |
| POST product target — cupón inexistente | 404 |
| POST product target — productId inválido (0) | 400 |
| GET product targets | 200 — array |
| GET product targets — cupón inexistente | 404 |
| DELETE product target | 204 |
| DELETE product target — ya eliminado | 404 |
| POST combo target — asignar | 201 |
| POST combo target — duplicado | 409 |
| POST combo target — cupón global | 409 |
| POST combo target — cupón inexistente | 404 |
| POST combo target — comboId inválido (0) | 400 |
| GET combo targets | 200 — array |
| GET combo targets — cupón inexistente | 404 |
| DELETE combo target | 204 |
| DELETE combo target — ya eliminado | 404 |

> **Nota:** Los casos de `CouponUsageService` (race condition, límite de uso, usuario duplicado) están cubiertos en unit tests con `mockEntityManager` y `mockDataSource`. El e2e de usage no se implementa porque `CouponUsageEntity` tiene FKs a `UserEntity` y `OrderEntity`, lo que requeriría arrastrar toda la cadena de dependencias de esos módulos al schema de test.

---

## Integración con otros módulos

```
CouponsModule
  ├── exporta CouponService
  │     └── consumido por CalculationService (pricing/)
  │           └── valida código, calcula descuento sobre finalPrice
  │
  └── exporta CouponUsageService
        └── consumido por OrdersModule
              └── llamado al confirmar una orden con cupón
                  (transacción con pessimistic lock sobre la fila del cupón)
```

`CouponUsageEntity` tiene FKs con `onDelete: 'RESTRICT'` hacia `CouponEntity`, `UserEntity` y `OrderEntity` — un cupón con usos registrados no puede eliminarse a nivel de DB (solo soft delete).
