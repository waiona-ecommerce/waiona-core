# Orders — Análisis Técnico Completo

## ¿Qué es el módulo orders?

El módulo de órdenes gestiona el ciclo de vida de los pedidos en Waiona: creación por el cliente, seguimiento de estados por el administrador, reserva y liberación de stock, y aplicación de cupones con transacción atómica. Es el núcleo operativo de la plataforma — conecta productos, stock, precios, cupones y pagos.

```
POST   /orders                 → cliente crea pedido (throttle: 5 req/60s)
GET    /orders                 → admin lista pedidos paginados
GET    /orders/user/:userId    → cliente ve sus pedidos / admin ve los de cualquier usuario
GET    /orders/:id             → cliente ve propia orden / admin ve cualquier orden
PATCH  /orders/:id/status      → admin avanza el estado de la orden
```

### Máquina de estados

```
PENDING ──→ CONFIRMED ──→ DISPATCHED ──→ DELIVERED
   └──────→ CANCELLED
              └──────────→ CANCELLED
```

Cada transición tiene efectos secundarios en stock y cupones (ver reglas de negocio).

---

## Tipos de datos

### `OrderEntity`

```typescript
{
  id:             number;        // PK autoincrement (BaseEntity)
  createdAt:      Date;
  updatedAt:      Date;
  isDeleted:      boolean;       // soft delete (BaseEntity)

  userId:         number;        // FK → users.id (RESTRICT)
  user:           UserEntity;    // ManyToOne, onDelete: RESTRICT

  couponId?:      number | null; // FK → coupons.id (RESTRICT), nullable
  coupon?:        CouponEntity | null;

  items:          OrderItemEntity[];  // OneToMany, cascade: true

  status:         OrderStatus;   // enum: PENDING|CONFIRMED|DISPATCHED|DELIVERED|CANCELLED
  deliveryType:   DeliveryType;  // enum: PICKUP|DELIVERY

  address?:       string | null; // requerido si deliveryType = DELIVERY, max 500 chars
  notes?:         string | null; // texto libre, max 500 chars

  subtotal:       number;        // decimal(12,2) — suma de finalPrice de todos los items
  couponDiscount?: number | null; // decimal(12,2) — monto del descuento aplicado
  total:          number;        // decimal(12,2) — subtotal - couponDiscount (mínimo 0)
}
```

### `OrderItemEntity`

```typescript
{
  id:               number;
  orderId:          number;        // FK → orders.id (CASCADE)
  order:            OrderEntity;

  productId?:       number | null; // FK → products.id (RESTRICT), nullable
  product?:         ProductEntity | null;

  comboId?:         number | null; // FK → combos.id (RESTRICT), nullable
  combo?:           ComboEntity | null;

  quantity:         number;        // int
  unitPrice:        number;        // decimal(12,2) — precio unitario al momento de compra
  finalPrice:       number;        // decimal(12,2) — unitPrice * quantity (snapshot)

  locationId?:      number | null; // FK → stock_locations.id — para dispatch individual de producto
  comboReservations?: Array<{      // JSON — reservas por componente del combo
    productId: number;
    locationId: number;
    quantity: number;
  }> | null;
}
```

### `OrderResponseDto`

```typescript
{
  id:             number;
  createdAt:      Date;
  updatedAt:      Date;
  userId:         number;
  status:         OrderStatus;
  deliveryType:   DeliveryType;
  address:        string | null;
  notes:          string | null;
  subtotal:       number;
  couponDiscount: number | null;
  couponCode:     string | null;   // código del cupón aplicado, si hubo
  total:          number;
  items:          OrderItemResponseDto[];
}
```

### `OrderItemResponseDto`

```typescript
{
  id:          number;
  productId:   number | null;
  productName: string | null;
  comboId:     number | null;
  comboName:   string | null;
  quantity:    number;
  unitPrice:   number;
  finalPrice:  number;
}
```

---

## Endpoints

### `POST /orders` — Crear orden

**Auth:** JWT requerido (cualquier rol autenticado)  
**Throttle:** 5 peticiones por 60 segundos por cliente

**Request body:**

```json
{
  "items": [
    { "productId": 3, "quantity": 2 },
    { "comboId": 1, "quantity": 1 }
  ],
  "deliveryType": "delivery",
  "address": "Av. Corrientes 1234",
  "couponCode": "PROMO10",
  "notes": "Sin cebolla"
}
```

**Reglas del body:**
- `items`: mínimo 1 elemento. Cada item debe tener exactamente `productId` o `comboId` (no ambos, no ninguno)
- `quantity`: entre 1 y 500
- `address`: requerido si `deliveryType = delivery`, max 500 chars
- `couponCode`: opcional, max 100 chars
- `notes`: opcional, max 500 chars

**Response 201:**

```json
{
  "id": 42,
  "createdAt": "2025-10-15T14:00:00.000Z",
  "updatedAt": "2025-10-15T14:00:00.000Z",
  "userId": 7,
  "status": "pending",
  "deliveryType": "delivery",
  "address": "Av. Corrientes 1234",
  "notes": "Sin cebolla",
  "subtotal": 5500,
  "couponDiscount": 550,
  "couponCode": "PROMO10",
  "total": 4950,
  "items": [
    {
      "id": 101,
      "productId": 3,
      "productName": "Milanesa napolitana",
      "comboId": null,
      "comboName": null,
      "quantity": 2,
      "unitPrice": 1500,
      "finalPrice": 3000
    },
    {
      "id": 102,
      "productId": null,
      "productName": null,
      "comboId": 1,
      "comboName": "Combo Familiar",
      "quantity": 1,
      "unitPrice": 2500,
      "finalPrice": 2500
    }
  ]
}
```

**Errors:**
- `400` — body inválido, stock insuficiente, cupón vencido/agotado/no aplica, delivery sin dirección
- `404` — producto, combo o cupón no encontrado

---

### `GET /orders` — Listar órdenes (admin)

**Auth:** JWT + rol ADMIN o SUPER_ADMIN

**Query params:**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | number | 1 | Página actual |
| `limit` | number | 20 | Resultados por página |

**Response 200:**

```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8,
  "hasNextPage": true
}
```

---

### `GET /orders/user/:userId` — Órdenes por usuario

**Auth:** JWT requerido  
**Autorización:** cliente solo puede ver sus propias órdenes (`req.user.sub === userId`). Admin puede ver cualquier usuario.

**Response 200:** Array de `OrderResponseDto` ordenado por `createdAt DESC`

**Errors:**
- `403` — cliente intenta ver órdenes de otro usuario

---

### `GET /orders/:id` — Obtener orden por ID

**Auth:** JWT requerido  
**Autorización:** cliente solo puede ver sus propias órdenes (`order.userId === req.user.sub`). Admin sin restricción.

**Response 200:** `OrderResponseDto` con items, producto/combo, cupón

**Errors:**
- `403` — cliente intenta ver orden de otro usuario
- `404` — orden no encontrada

---

### `PATCH /orders/:id/status` — Actualizar estado

**Auth:** JWT + rol ADMIN o SUPER_ADMIN

**Request body:**

```json
{ "status": "confirmed" }
```

**Valores válidos de `status`:** `confirmed`, `dispatched`, `delivered`, `cancelled`

**Transiciones válidas:**

| Estado actual | Puede ir a |
|---|---|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `dispatched`, `cancelled` |
| `dispatched` | `delivered` |
| `delivered` | — (terminal) |
| `cancelled` | — (terminal) |

**Efectos secundarios:**
- `dispatched` → descuenta stock real con `StockItemsService.dispatchStock()`
- `cancelled` → libera reserva con `StockItemsService.releaseReservation()` + revierte uso del cupón

**Errors:**
- `400` — transición inválida o status no reconocido
- `404` — orden no encontrada

---

## Reglas de negocio

| Regla | Implementación |
|---|---|
| Stock reservado al crear la orden | `StockItemsService.reserveStock()` dentro de la transacción |
| Stock descontado al despachar | `StockItemsService.dispatchStock()` en `handleDispatch` |
| Stock liberado al cancelar | `StockItemsService.releaseReservation()` en `handleCancellation` |
| Cupón con lock pesimista | `manager.findOne(CouponEntity, { lock: 'pessimistic_write' })` evita TOCTOU |
| Cupón revertido al cancelar | `usageCount - 1` + `softDelete` del `CouponUsageEntity` |
| Snapshot de precios | `unitPrice` y `finalPrice` guardados al crear — no cambian si cambia el pricing |
| Stock elegido por disponibilidad | La ubicación con mayor `quantityAvailable` para el producto |
| Precios calculados por `CalculationService` | Separación de responsabilidades — orders no calcula, solo llama |
| Lock en updateStatus (dos queries) | Lock-only primero (sin relaciones), luego carga con relaciones — evita error PostgreSQL "FOR UPDATE on nullable outer join" |
| Throttle en creación | 5 req / 60s por usuario para prevenir abuse |

---

## Flujo interno de `create`

```
1. Validar que el usuario existe
2. Validar que cada item tiene productId XOR comboId
3. Validar que si deliveryType = DELIVERY, hay address
4. Por cada item:
   a. Cargar producto o combo
   b. Encontrar stock disponible (mejor ubicación)
   c. Calcular precio con CalculationService
   d. Construir OrderItemEntity (snapshot de precios + locationId/comboReservations)
5. Calcular descuento del cupón (si hay)
6. Iniciar transacción:
   a. Lock pesimista sobre el cupón
   b. Validar cupón (fechas, límite, uso previo del usuario)
   c. Guardar OrderEntity + OrderItemEntity (cascade)
   d. Reservar stock para cada item (atómico)
   e. Registrar CouponUsageEntity + incrementar usageCount
7. Retornar OrderResponseDto
```

---

## Dependencias del módulo

| Dependencia | Uso |
|---|---|
| `StockItemsService` | Reservar, despachar y liberar stock |
| `CalculationService` | Calcular `unitPrice` y `finalPrice` por producto/combo |
| `DataSource` | Transacciones con `dataSource.transaction()` |
| `CouponEntity` | Validación y lock pesimista del cupón |
| `CouponUsageEntity` | Registro de uso por usuario/orden |
| `ProductEntity` / `ComboEntity` | Validar existencia y cargar datos del item |
| `UserEntity` | Validar existencia del comprador |

---

## Conformidad con estándares

### nestjs-core

| Regla | Estado |
|---|---|
| Guards a nivel clase con `@UseGuards(AuthGuard('jwt'))` | ✅ |
| `@Roles()` + `RolesGuard` para endpoints de admin | ✅ GET /orders y PATCH /:id/status |
| Rutas específicas antes de genéricas | ✅ `GET /user/:userId` está antes de `GET /:id` |
| `ValidationPipe` con `whitelist`, `forbidNonWhitelisted`, `transform` | ✅ (global, configurado en main.ts) |
| `@ApiTags`, `@ApiBearerAuth` a nivel clase | ✅ |
| `@ApiResponse` con `type: OrderResponseDto` en todos los endpoints | ✅ |
| `@ApiProperty` en todos los campos de DTOs | ✅ |
| Throttle en endpoints de creación sensibles | ✅ 5/60s en POST /orders |

### typeorm-standard

| Regla | Estado |
|---|---|
| `@Column` explícito para cada FK junto al `@ManyToOne` | ✅ `userId`, `couponId`, `orderId`, `productId`, `comboId` |
| `onDelete: 'RESTRICT'` en relaciones ManyToOne | ✅ Todas excepto `order → items` (CASCADE) |
| Soft delete con `isDeleted = true` (BaseEntity) | ✅ |
| Transacciones con `dataSource.transaction()` | ✅ en `create` y `updateStatus` |
| Lock pesimista para concurrencia | ✅ cupón en `create`, orden en `updateStatus` |
| Columnas `decimal` con `transformer` para convertir a `Number` | ✅ `subtotal`, `couponDiscount`, `total` |

---

## Tests

### Unitarios (`orders.service.spec.ts`, `orders.controller.spec.ts`)

- **37 tests** — `OrdersService` + `OrdersController`
- Repositorios mockeados con `jest.fn()`
- Factory `mockOrder(overrides)` para datos de prueba
- Cubren: create (con/sin cupón, stock insuficiente, producto no encontrado), findAll (paginado), findOne (ownership), findByUser (ownership), updateStatus (todas las transiciones válidas e inválidas)

### E2E (`test/orders/orders.e2e-spec.ts`)

- **20 tests** — PostgreSQL real (puerto 5433), schema sincronizado y destruido en cada suite
- `CalculationService` mockeado (precios fijos: `unitPrice=1000`, `finalPrice=1000`)
- `StockItemsService` real — valida la integración de reservas
- JWT override con `mockUser` mutable para simular cambio de rol/usuario
- Seed completo: perfil → usuario → categoría → producto → ubicación de stock → stock (50 unidades)
- Cubren: POST (201 pickup, 201 delivery con dirección, 400 items vacíos, 400 delivery sin dirección, 400 sin productId/comboId, 404 producto inexistente, 400 stock insuficiente), GET /orders (paginado, limit), GET /orders/user/:id (200 + 403 cliente), GET /orders/:id (200 + 404 + 403 cliente), PATCH /:id/status (PENDING→CONFIRMED, CONFIRMED→PENDING inválido, CONFIRMED→CANCELLED, CANCELLED→CONFIRMED inválido, status inválido, 404)
