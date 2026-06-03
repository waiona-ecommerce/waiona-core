# Discounts — Análisis Técnico Completo

## ¿Qué es un descuento?

Un descuento representa una reducción de precio que se aplica **antes del margen y antes de los impuestos** dentro del motor de cálculo de precios.

```
unitPrice
  → aplicar descuento        → priceAfterDiscount     ← acá actúa este módulo
  → aplicar margen           → priceAfterMargin
  → aplicar impuestos        → finalPrice
  → aplicar cupón            → orderTotal
```

Un descuento se **asigna a productos o combos específicos** mediante entidades target. Un mismo descuento puede cubrir múltiples productos y/o combos. Sin embargo, **un producto o combo solo puede tener un descuento activo a la vez**.

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Descuento estacional | "Black Friday 20%" aplicado a productos seleccionados |
| Descuento con vigencia | Empieza el 1/11 y termina el 30/11 |
| Descuento permanente | Sin fechas, activo hasta que se elimine |

---

## Estructura del módulo

El módulo de discounts está compuesto por tres sub-módulos:

```
discounts/
├── discount/                        → CRUD del descuento (nombre, valor, fechas)
├── discount-product-target/        → asignación de descuento a productos
└── discount-combo-target/          → asignación de descuento a combos
```

---

## Tipos de datos

### Entidad (`DiscountEntity`)

```typescript
{
  id:           number;      // PK autoincremental
  name:         string;      // nombre del descuento, 3–100 chars
  description?: string;      // descripción opcional, máx 255 chars
  value:        number;      // decimal(10,2) — porcentaje, viene como string de PG, convertido en DTO
  startsAt?:    Date;        // inicio de vigencia (opcional)
  endsAt?:      Date;        // fin de vigencia (opcional)
  deletedAt:    Date | null; // soft delete vía @DeleteDateColumn
  createdAt:    Date;
  updatedAt:    Date;
}
```

### Enum `DiscountStatus`

```typescript
enum DiscountStatus {
  ACTIVE    = 'active',      // vigente ahora
  SCHEDULED = 'scheduled',   // aún no empezó (startsAt > now)
  EXPIRED   = 'expired',     // ya venció (endsAt < now) o endsAt < startsAt
}
```

El status **no se persiste en la base de datos** — se calcula en tiempo real dentro de `DiscountResponseDto.calculateStatus()`.

### Request: crear descuento (`CreateDiscountDto`)

```typescript
{
  name:          string;  // requerido, 3–100 chars — normalizado a MAYÚSCULAS + trim automáticamente
  description?:  string;  // opcional, 3–255 chars
  value:         number;  // requerido, >= 0.01, <= 100, máx 2 decimales — siempre porcentaje
  startsAt?:     Date;    // opcional — ISO 8601
  endsAt?:       Date;    // opcional — ISO 8601
}
```

### Request: actualizar descuento (`UpdateDiscountDto`)

Todos los campos son opcionales (`PartialType` de `CreateDiscountDto` vía `@nestjs/swagger`):

```typescript
{
  name?:         string;
  description?:  string;
  value?:        number;
  startsAt?:     Date;
  endsAt?:       Date;
}
```

### Response: descuento (`DiscountResponseDto`)

```typescript
{
  id:            number;
  name:          string;
  description?:  string;
  status:        DiscountStatus;  // calculado en tiempo real
  value:         number;          // Number(entity.value) — fix decimal PG — siempre porcentaje
  startsAt?:     Date;
  endsAt?:       Date;
  createdAt:     Date;
  updatedAt:     Date;
}
```

### Response: listado paginado (`PaginatedResponseDto<DiscountResponseDto>`)

```typescript
{
  data:        DiscountResponseDto[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
  hasNextPage: boolean;
}
```

### Entidad target de producto (`DiscountProductTargetEntity`)

```typescript
{
  id:         number;
  discountId: number;   // FK → discount_id (CASCADE DELETE)
  productId:  number;   // FK → product_id (CASCADE DELETE)
  deletedAt:  Date | null;
  createdAt:  Date;
  updatedAt:  Date;
}
```

### Entidad target de combo (`DiscountComboTargetEntity`)

```typescript
{
  id:         number;
  discountId: number;   // FK → discount_id (CASCADE DELETE)
  comboId:    number;   // FK → combo_id (CASCADE DELETE)
  deletedAt:  Date | null;
  createdAt:  Date;
  updatedAt:  Date;
}
```

### Response: target (`DiscountProductTargetResponseDto` / `DiscountComboTargetResponseDto`)

```typescript
{
  id:          number;
  discountId:  number;
  productId:   number;   // o comboId según el tipo
  createdAt:   Date;
  updatedAt:   Date;
}
```

---

## Endpoints

Todos los endpoints requieren JWT con rol `SUPER_ADMIN` o `ADMIN`.

---

### `POST /v1/discounts`

Crea un nuevo descuento.

Los descuentos son siempre porcentuales.

**Request:**
```json
{
  "name": "Black Friday",
  "description": "Descuento de temporada",
  "value": 20,
  "startsAt": "2025-11-01T00:00:00.000Z",
  "endsAt": "2025-11-30T23:59:59.000Z"
}
```

**Response 201:**
```json
{
  "id": 1,
  "name": "BLACK FRIDAY",
  "description": "Descuento de temporada",
  "status": "scheduled",
  "value": 20,
  "startsAt": "2025-11-01T00:00:00.000Z",
  "endsAt": "2025-11-30T23:59:59.000Z",
  "createdAt": "2026-05-17T10:00:00.000Z",
  "updatedAt": "2026-05-17T10:00:00.000Z"
}
```

**Errores posibles:**
- `400` — `startsAt >= endsAt` (rango vacío o invertido)

---

### `GET /v1/discounts?page=1&limit=20`

Lista paginada de descuentos activos (no eliminados), orden descendente por `createdAt`.

**Query params** (opcionales):
```
page  → default: 1, min: 1
limit → default: 20, min: 1, máx: 100
```

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Black Friday",
      "status": "active",
      "value": 20,
      "createdAt": "2026-05-17T10:00:00.000Z",
      "updatedAt": "2026-05-17T10:00:00.000Z"
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

### `GET /v1/discounts/:id`

Obtiene un descuento por ID.

**Response 200:** `DiscountResponseDto`

**Errores posibles:**
- `404` — no encontrado

---

### `PATCH /v1/discounts/:id`

Actualización parcial. Solo se actualiza lo que se envía. Reconstruye el estado final explícitamente campo a campo (sin spread de DTO) para evitar pisar valores existentes con `undefined`.

**Request:**
```json
{ "value": 25 }
```

**Response 200:** `DiscountResponseDto` actualizado

**Errores posibles:**
- `400` — fechas inválidas o valor fuera de rango
- `404` — no encontrado

---

### `DELETE /v1/discounts/:id`

Soft delete. El descuento queda marcado con `deletedAt` y deja de aparecer en listados.

**Response 204:** sin body

**Errores posibles:**
- `404` — no encontrado

---

### `POST /v1/discounts/:discountId/targets/products`

Asigna un producto a un descuento.

**Request:**
```json
{ "productId": 5 }
```

**Response 201:**
```json
{
  "id": 1,
  "discountId": 1,
  "productId": 5,
  "createdAt": "2026-05-17T10:00:00.000Z",
  "updatedAt": "2026-05-17T10:00:00.000Z"
}
```

**Errores posibles:**
- `404` — descuento no encontrado
- `409` — el producto ya está asignado a este descuento
- `409` — el producto ya tiene otro descuento activo asignado

---

### `GET /v1/discounts/:discountId/targets/products`

Lista paginada de productos asignados a un descuento.

**Query params** (opcionales): `page` (default: 1), `limit` (default: 20, máx: 100)

**Response 200:** `PaginatedResponseDto<DiscountProductTargetResponseDto>`

**Errores posibles:**
- `404` — descuento no encontrado

---

### `DELETE /v1/discounts/:discountId/targets/products/:productId`

Quita un producto de un descuento (soft delete del target).

**Response 204:** sin body

**Errores posibles:**
- `404` — descuento no encontrado
- `404` — el producto no estaba asignado a este descuento

---

### `POST /v1/discounts/:discountId/targets/combos`

Asigna un combo a un descuento.

**Request:**
```json
{ "comboId": 3 }
```

**Response 201:**
```json
{
  "id": 1,
  "discountId": 1,
  "comboId": 3,
  "createdAt": "2026-05-17T10:00:00.000Z",
  "updatedAt": "2026-05-17T10:00:00.000Z"
}
```

**Errores posibles:**
- `404` — descuento no encontrado
- `409` — el combo ya está asignado a este descuento
- `409` — el combo ya tiene otro descuento activo asignado

---

### `GET /v1/discounts/:discountId/targets/combos`

Lista paginada de combos asignados a un descuento.

**Query params** (opcionales): `page` (default: 1), `limit` (default: 20, máx: 100)

**Response 200:** `PaginatedResponseDto<DiscountComboTargetResponseDto>`

**Errores posibles:**
- `404` — descuento no encontrado

---

### `DELETE /v1/discounts/:discountId/targets/combos/:comboId`

Quita un combo de un descuento (soft delete del target).

**Response 204:** sin body

**Errores posibles:**
- `404` — descuento no encontrado
- `404` — el combo no estaba asignado a este descuento

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| `startsAt` debe ser estrictamente menor que `endsAt` (usa `>=`) | `create` y `update` — `validateDates()` |
| `value` entre 0.01 y 100 (siempre porcentaje) | `@Min` / `@Max` en el DTO |
| Un producto solo puede tener un target activo en toda la tabla | `create` target — `validateProductHasNoActiveDiscount()` |
| Un combo solo puede tener un target activo en toda la tabla | `create` target — `validateComboHasNoActiveDiscount()` |
| `validateUniqueTarget` evita duplicado en el mismo descuento | `create` target — usa `{ discountId, productId/comboId, deletedAt: IsNull() }` con `withDeleted: true` para ignorar los soft-deleted |
| `validateProductHasNoActiveDiscount` / `validateComboHasNoActiveDiscount` | QueryBuilder con `innerJoin('target.discount', 'discount')` + filtros `deletedAt IS NULL` en ambas tablas — evita falsos positivos con targets o descuentos borrados |
| Eliminar un descuento también soft-deletes sus targets | `DiscountsService.remove()` llama `softDelete({ discountId })` en `productTargetRepo` y `comboTargetRepo` antes de invalidar la caché |
| `status` calculado en tiempo real — no persiste en DB | `DiscountResponseDto.calculateStatus()` |
| Soft delete — `deletedAt` — TypeORM filtra `IS NULL` automáticamente | `remove` y `findDiscount` — `repo.softDelete()` |

### Lógica de `calculateStatus()`

```
si endsAt < startsAt               → EXPIRED  (rango inválido)
si now > endsAt                    → EXPIRED  (venció)
si now < startsAt                  → SCHEDULED (aún no empieza)
en cualquier otro caso             → ACTIVE
```

Un descuento sin fechas siempre devuelve `ACTIVE`.

---

## Ejemplos de uso real

**Descuento porcentual con fechas:**
```json
POST /v1/discounts
{
  "name": "Black Friday 20%",
  "value": 20,
  "startsAt": "2025-11-01T00:00:00.000Z",
  "endsAt": "2025-11-30T23:59:59.000Z"
}
```

**Asignar un producto:**
```json
POST /v1/discounts/1/targets/products
{ "productId": 7 }
```

**Quitar un producto del descuento:**
```json
DELETE /v1/discounts/1/targets/products/7
→ 204 No Content
```

**Intentar asignar un producto que ya tiene otro descuento — responde 409:**
```json
POST /v1/discounts/2/targets/products
{ "productId": 7 }
→ 409 Conflict: "El producto 7 ya tiene un descuento activo asignado"
```

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Entidades extienden `BaseEntity` con `@DeleteDateColumn` | ✅ |
| Soft delete vía `repo.softDelete(id)` | ✅ |
| TypeORM filtra `deletedAt IS NULL` automáticamente | ✅ |
| Service retorna DTOs, nunca entidades | ✅ |
| `ParseIntPipe` en todos los params de ID | ✅ |
| Guards a nivel de clase en los tres controllers | ✅ |
| `PartialType` de `@nestjs/swagger` en `UpdateDiscountDto` | ✅ |
| `Number(entity.value)` en `DiscountResponseDto` — fix decimal de PG | ✅ |
| `@HttpCode(204)` en todos los DELETE | ✅ |
| `GuardsModule` no importado en el módulo | ✅ |
| `status` calculado en DTO, no persiste en DB | ✅ |
| `validateDates()` usa `>=` para bloquear rango vacío | ✅ |
| Validación cross-discount: un producto/combo solo tiene un descuento activo | ✅ |
| Unit tests — service y controller, 6 suites | ✅ |
| E2E tests — PostgreSQL real, `dropSchema: true`, 46 tests | ✅ |
| Swagger — `@ApiTags`, `@ApiOperation`, `@ApiResponse` en los 3 controllers | ✅ |
| Swagger — `@ApiProperty` en todos los DTOs | ✅ |

---

## Tests

### Unit tests (`src/modules/discounts/`)

```bash
npx jest --testPathPattern="discounts" --no-coverage
```

| Suite | Tests | Cobertura |
|---|---|---|
| `discount/services/discounts.service.spec.ts` | 13 | create, findAll, findOne, update, remove — happy path + 400/404 |
| `discount/controllers/discounts.controller.spec.ts` | 10 | delegación a service, paginación, propagación de errores |
| `discount-product-target/services/discount-product-target.service.spec.ts` | 8 | create + conflictos, findAll, remove |
| `discount-product-target/controllers/discount-product-target.controller.spec.ts` | 7 | delegación a service, errores |
| `discount-combo-target/services/discount-combo-target.service.spec.ts` | 8 | create + conflictos, findAll, remove |
| `discount-combo-target/controllers/discount-combo-target.controller.spec.ts` | 7 | delegación a service, errores |

### E2E tests (`test/discounts/discounts.e2e-spec.ts`)

```bash
# Requiere Docker con la DB de test corriendo (puerto 5433)
docker compose up -d
npx jest --config test/jest-e2e.json --testPathPattern="discounts"
```

| Caso | Status code esperado |
|---|---|
| POST descuento activo | 201 |
| POST descuento programado | 201 — status: scheduled |
| POST descuento vencido | 201 — status: expired |
| POST descuento permanente | 201 — status: active |
| POST sin campos requeridos | 400 |
| POST value fuera de rango | 400 |
| POST startsAt >= endsAt | 400 |
| GET paginado | 200 — data[], total, page, limit |
| GET con `?page=1&limit=2` | 200 |
| GET con `?page=0` | 400 |
| GET con `?limit=0` | 400 |
| GET por id existente | 200 — con status |
| GET por id inexistente | 404 |
| PATCH actualiza valor | 200 — status definido |
| PATCH actualiza value | 200 |
| PATCH id inexistente | 404 |
| DELETE exitoso + GET posterior | 204 → 404 |
| DELETE id inexistente | 404 |
| POST target producto — asignar | 201 |
| POST target producto — descuento inexistente | 404 |
| POST target producto — mismo descuento duplicado | 409 |
| POST target producto — producto con otro descuento | 409 |
| POST target producto — reasignar tras soft delete | 201 |
| GET targets productos de un descuento | 200 |
| GET targets productos — descuento inexistente | 404 |
| DELETE target producto | 204 |
| DELETE target producto — target inexistente | 404 |
| DELETE target producto — GET posterior da 404 | — |
| POST target combo — asignar | 201 |
| POST target combo — descuento inexistente | 404 |
| POST target combo — mismo descuento duplicado | 409 |
| POST target combo — combo con otro descuento | 409 |
| POST target combo — reasignar tras soft delete | 201 |
| GET targets combos de un descuento | 200 |
| GET targets combos — descuento inexistente | 404 |
| DELETE target combo | 204 |
| DELETE target combo — target inexistente | 404 |
| DELETE target combo — GET posterior da 404 | — |

---

## Swagger

Disponible en `/api/docs` una vez que la app está corriendo.

Decoradores aplicados:
- `DiscountsController`: `@ApiTags('Discounts')`, `@ApiBearerAuth()`
- `DiscountProductTargetController`: `@ApiTags('Discounts — Product Targets')`, `@ApiBearerAuth()`
- `DiscountComboTargetController`: `@ApiTags('Discounts — Combo Targets')`, `@ApiBearerAuth()`
- Cada endpoint: `@ApiOperation`, `@ApiResponse` (201/200/204/400/404/409), `@ApiParam`
- DTOs: `@ApiProperty` con ejemplos en todos los campos

---

## Integración con otros módulos

```
DiscountsModule
  └── exporta DiscountsService (no usa actualmente como dependencia externa)
        └── consumido internamente por calculation/
              └── CalculationService → busca el target activo del producto/combo
                                       para obtener el valor de descuento a aplicar
```

El `DiscountProductTargetEntity` y `DiscountComboTargetEntity` están registrados con `@ManyToOne` hacia `ProductEntity` y `ComboEntity` con `onDelete: 'CASCADE'` — si se elimina el producto o combo, sus targets se eliminan automáticamente.
