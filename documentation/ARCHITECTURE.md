# Waiona Core — Arquitectura General

## ¿Qué es Waiona?

Waiona es una plataforma de e-commerce y delivery. Este repositorio es el backend: una API REST desarrollada con **NestJS + TypeScript + PostgreSQL + TypeORM** que expone todos los endpoints necesarios para que clientes vean productos, creen órdenes, paguen con MercadoPago, y para que administradores gestionen el catálogo, inventario, precios, descuentos, cupones e impuestos.

---

## Stack Técnico

| Tecnología | Rol |
|---|---|
| **NestJS** | Framework principal — módulos, inyección de dependencias, pipes, guards |
| **TypeScript** | Lenguaje de toda la codebase |
| **TypeORM** | ORM — entidades, repositorios, transacciones, migraciones |
| **PostgreSQL** | Base de datos relacional principal |
| **JWT + Passport** | Autenticación — estrategias `local` (login) y `jwt` (peticiones autenticadas) |
| **MercadoPago SDK** | Procesamiento de pagos y webhooks |
| **Resend SDK** | Envío de emails transaccionales |
| **class-validator** | Validación de DTOs en request bodies y query params |
| **Jest** | Tests unitarios y e2e |
| **Docker** | Entorno de base de datos para tests e2e |

---

## Estructura de Módulos

```
src/
├── common/
│   ├── decorators/roles.decorator.ts    → @Roles(RoleType.ADMIN)
│   ├── entities/base.entity.ts          → id, createdAt, updatedAt, isDeleted
│   ├── entities/base.audit.entity.ts    → sin isDeleted (log inmutable)
│   ├── enums/role-type.enum.ts          → SUPER_ADMIN | ADMIN | CLIENT
│   ├── guards/roles.guard.ts            → lee rol del JWT payload sin DB query
│   └── guards/guards.module.ts
│
└── modules/
    ├── auth/                            → login, register, activación, reset password
    ├── users/                           → CRUD usuarios
    ├── seed/                            → inicialización de roles y superadmin
    ├── mail/                            → servicio de email con Resend
    ├── products/
    │   ├── product/                     → CRUD productos
    │   ├── combos/                      → CRUD combos (conjunto de productos)
    │   ├── categories/                  → árbol de categorías padre/hijo
    │   ├── product-images/             → imágenes por posición
    │   ├── combo-images/               → imágenes de combos
    │   └── shop/                        → endpoints públicos para clientes
    ├── pricing/
    │   ├── product-pricing/            → precio base por producto
    │   ├── combo-pricing/              → precio base por combo
    │   └── calculation/                → motor de cálculo de precios
    ├── taxation/
    │   ├── taxes/                       → impuestos globales
    │   ├── tax-types/                  → tipos de impuesto (IVA, IIBB, etc.)
    │   ├── product-taxes/              → impuestos por producto
    │   └── combo-taxes/               → impuestos por combo
    ├── margins/                         → márgenes de ganancia
    ├── discounts/
    │   ├── discount/                    → descuentos con rango de fechas
    │   ├── discount-product-target/    → descuento aplicado a producto
    │   └── discount-combo-target/      → descuento aplicado a combo
    ├── coupons/
    │   ├── coupon/                      → códigos de cupón con límite de uso
    │   ├── coupon-product-target/      → cupón para producto
    │   ├── coupon-combo-target/        → cupón para combo
    │   └── usage/                       → registro de usos
    ├── stocks/
    │   ├── stock-item/                 → stock por producto+ubicación
    │   ├── stock-locations/            → depósitos y sucursales
    │   ├── stock-movement/            → log de operaciones (inmutable)
    │   └── stock-writeoff/            → bajas por daño, vencimiento, etc.
    ├── orders/                          → ciclo de vida de pedidos
    └── payments/                        → pagos con MercadoPago + webhook
```

---

## Mapa de Dependencias entre Módulos

```
                        ┌───────────────────────────────┐
                        │         SEED MODULE            │
                        │  Crea roles + superadmin al   │
                        │  arrancar (bootstrap)         │
                        └───────────────────────────────┘

  ┌──────────────┐      ┌───────────────────────────────┐
  │   MAIL       │◄─────│          AUTH                  │
  │  (Resend)    │      │  register → activación email  │
  └──────────────┘      │  forgot password → reset email│
                        │  JWT generado en login        │
                        └──────────────┬────────────────┘
                                       │ usa
                                       ▼
                              ┌─────────────────┐
                              │     USERS        │
                              │  findByEmail()  │
                              │  create()       │
                              │  activate()     │
                              └─────────────────┘

──────────────────── CATÁLOGO ────────────────────────────

  ┌───────────────────────────────────────────────────────┐
  │  PRODUCTS                                             │
  │  ├── Categories (árbol padre/hijo)                   │
  │  ├── Products (requiere categoryId)                  │
  │  ├── Combos (items + categoryId)                     │
  │  └── Images (Products + Combos, ordenadas)           │
  │                                                       │
  │  SHOP (sub-módulo público)                           │
  │  ├── Usa CalculationService → precio breakdown       │
  │  └── Usa StockItemsService → disponibilidad         │
  └───────────────────────────────────────────────────────┘

──────────────────── PRICING ─────────────────────────────

  ┌─────────────────────────────────────────────────────────────────┐
  │  ProductPricing / ComboPricing                                  │
  │      └── referencian MarginEntity (FK)                          │
  │                                                                  │
  │  CalculationService  (re-exportado desde PricingModule)         │
  │      Inputs: productId o comboId                                │
  │      Lee: ProductPricing/ComboPricing → Discounts → Margin      │
  │           → Taxes (product-specific + global)                   │
  │      Outputs: PriceBreakdownDto                                 │
  │      Consumido por: OrdersModule, ShopModule                    │
  │                                                                  │
  │  MarginsService                                                  │
  │      CRUD márgenes; valida que no estén en uso al eliminar      │
  │                                                                  │
  │  DiscountsService                                                │
  │      Descuentos % o fijo, con rango de fechas                   │
  │      Aplicados por producto o combo                              │
  │                                                                  │
  │  TaxationModule                                                  │
  │      Impuestos globales + por producto + por combo              │
  │      Exporta sus 4 services (usados directamente en Calc)       │
  └─────────────────────────────────────────────────────────────────┘

──────────────────── INVENTARIO ──────────────────────────

  ┌──────────────────────────────────────────────────────────────────┐
  │  StocksModule                                                    │
  │  ├── StockLocations  → depósitos y tiendas                      │
  │  ├── StockItems      → stock por (producto, ubicación)          │
  │  │       quantityCurrent   = físico real                        │
  │  │       quantityReserved  = bloqueado por órdenes PENDING      │
  │  │       quantityAvailable = Current - Reserved  (getter)       │
  │  ├── StockMovements  → log inmutable de cada operación          │
  │  └── StockWriteOffs  → bajas documentadas (daño, vencimiento)   │
  │                                                                  │
  │  Consumido por: OrdersModule, ShopModule                        │
  └──────────────────────────────────────────────────────────────────┘

──────────────────── NEGOCIO ─────────────────────────────

  ┌──────────────────────────────────────────────────────────────────┐
  │  CouponsModule                                                   │
  │      Cupones con código, límite de uso, rango de fechas         │
  │      Aplicables por producto, combo o ambos                     │
  │      CouponUsageEntity registra cada uso (con transacción)      │
  │      Consumido por: OrdersModule                                │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │  OrdersModule                      ← núcleo operativo           │
  │                                                                  │
  │  Importa: CalculationModule, StocksModule                       │
  │  Accede directamente: CouponEntity, UserEntity, ProductEntity   │
  │                                                                  │
  │  Exporta: OrdersService (consumido por PaymentsModule)          │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │  PaymentsModule                                                  │
  │                                                                  │
  │  Importa: OrdersModule                                          │
  │  MercadoPagoProvider: crea preferencias, procesa webhook        │
  │  PaymentsService.releaseStockForOrder() ← via OrdersService     │
  └──────────────────────────────────────────────────────────────────┘
```

---

## Roles y Autenticación

### Roles

| Rol | Descripción |
|---|---|
| `super_admin` | Acceso total. Creado por el seed al iniciar. |
| `admin` | Gestión del negocio — productos, stock, precios, órdenes. |
| `client` | Asignado al registrarse. Ve el shop, crea órdenes, paga. |

### Cómo funciona el guard

El `RolesGuard` lee el rol directo del JWT payload (`{ sub: userId, role: RoleType }`) — sin queries a la DB. Esto hace que cada request autenticado no tenga overhead de base de datos solo para la autorización.

```typescript
// Patrón estándar en controllers de admin:
@Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('resource')
export class ResourceController {}
```

### JWT Payload

```typescript
{ sub: number, role: RoleType }
```

---

## Flujo de Autenticación

```
POST /auth/register
  → AuthService.register(dto)
  → UsersService.create(dto)         → UserEntity { isActive: false }
  → MailService.sendActivationEmail() → email con token único
  → 201

GET /auth/activate?token=X
  → AuthService.activateAccount(token)
  → TokenEntity validado + expiración
  → user.isActive = true
  → 200

POST /auth/login  { email, password }
  → LocalStrategy → AuthService.validateUser(email, password)
  → bcrypt.compare(password, hash)
  → si isActive = false → 401
  → JWT generado { sub, role }
  → 200 { access_token }

POST /auth/forgot-password  { email }
  → genera TokenEntity tipo RESET_PASSWORD
  → MailService.sendPasswordResetEmail()
  → 200

POST /auth/reset-password  { token, password }
  → TokenEntity validado
  → UsersService.updatePassword()     → bcrypt automático vía @BeforeInsert
  → 200
```

---

## Motor de Cálculo de Precios

`CalculationService` es el único punto de verdad para calcular cuánto vale un producto o combo. Se llama tanto desde el shop (para mostrar precios al cliente) como desde orders (para hacer snapshot del precio al momento de la compra).

### Pipeline de cálculo

```
unitPrice  (de ProductPricingEntity / ComboPricingEntity)
  │
  ├─ ¿Hay descuento activo? (DiscountProductTarget, fecha actual en rango)
  │    → priceAfterDiscount = unitPrice - discount
  │    (si no hay descuento, priceAfterDiscount = unitPrice)
  │
  ├─ Aplicar margen (MarginEntity referenciado en Pricing)
  │    → priceAfterMargin = priceAfterDiscount + margin
  │
  ├─ Aplicar impuestos (ProductTaxEntity + TaxEntity globales)
  │    → taxes = suma de todos los impuestos sobre priceAfterMargin
  │    → finalPrice = priceAfterMargin + taxes
  │
  └─ fullPrice = unitPrice + margin + taxes
     (precio sin descuento — para mostrar "antes/después" en el front)
```

### Output: `PriceBreakdownDto`

```typescript
{
  unitPrice:          number;  // precio base sin nada aplicado
  discount:           number;  // monto del descuento (0 si no hay)
  priceAfterDiscount: number;
  margin:             number;  // monto del margen
  priceAfterMargin:   number;
  taxes:              number;  // suma de todos los impuestos
  finalPrice:         number;  // lo que se cobra por unidad
  fullPrice:          number;  // precio tachado (sin descuento)
}
```

### Aplicación del cupón (en Orders, no en CalculationService)

```
orderTotal = sum(item.finalPrice * item.quantity)  ← subtotal
  → si hay couponCode:
      discount = computeOrderCouponDiscount(couponCode, items)
      total = max(orderTotal - discount, 0)
```

---

## Flujo Completo de una Orden

### 1. El cliente navega la tienda

```
GET /shop/products  o  GET /shop/combos
  → ShopService.search(dto)
  → Para cada producto/combo:
      CalculationService.calculateProduct/calculateCombo(id) → precios
      StockItemsService.findByProduct/findByCombo(id)       → disponibilidad
  → Responde lista con precio breakdown + quantityAvailable
```

### 2. El cliente crea la orden

```
POST /orders  { items, deliveryType, address?, couponCode?, notes? }
  → Throttle: 5 req / 60s por usuario

  Validaciones previas a la TX:
    1. Usuario existe
    2. Cada item tiene productId XOR comboId (no ambos)
    3. Si deliveryType = DELIVERY → address requerida
    4. Por cada item:
         a. Carga producto o combo
         b. findByProduct/findByCombo → ubicación con más stock disponible
         c. CalculationService.calculate... → snapshot de precio
    5. Si hay couponCode → computeOrderCouponDiscount()

  Transacción atómica:
    a. Lock pesimista en CouponEntity (evita race condition en uso concurrente)
    b. Valida cupón: fecha, límite de uso, que el usuario no lo haya usado
    c. Guarda OrderEntity (status: PENDING) + OrderItemEntity[] (cascade)
    d. StockItemsService.reserveStock() por cada producto
         → quantityReserved += quantity  (lock pessimistic_write)
         → guarda StockMovementEntity (ENTRY/INBOUND/ORDER)
    e. Guarda CouponUsageEntity + coupon.usageCount++
  
  Retorna: OrderResponseDto con snapshot completo de precios
```

### 3. El cliente inicia el pago

```
POST /payments  { orderId, provider: "mercadopago" }

  1. Valida orden PENDING + sin pago PENDING activo
  2. Lock pesimista en OrderEntity (previene doble pago concurrente)
  3. MercadoPagoProvider.createPreference(order)
       → crea preferencia en MP con items, monto, back_urls
       → retorna { externalId, checkoutUrl }
  4. Guarda PaymentEntity { status: PENDING, externalId, checkoutUrl, amount }
  5. Retorna { checkoutUrl } → el cliente redirige al checkout de MP
```

### 4. MercadoPago notifica el resultado (webhook)

```
POST /payments/webhook/mercadopago  (público, sin JWT, siempre retorna 200)

  1. Verifica firma HMAC-SHA256 del header x-signature
     (si MP_WEBHOOK_SECRET está configurado; se omite en dev)
  2. Según topic (merchant_order | payment):
       → Fetches el recurso desde la API de MP
       → Mapea order_status/status → PaymentStatus + OrderStatus
  3. Transacción atómica con locks pesimistas:
       → PaymentEntity.status = nuevo estado
       → Si pago aprobado  → OrderEntity.status = CONFIRMED
       → Si pago rechazado/revertido:
              → OrdersService.releaseStockForOrder(orderId)
                  → StockItemsService.releaseReservation() por cada item
                  → coupon.usageCount--  +  CouponUsageEntity softDelete
                  → OrderEntity.status = CANCELLED
  4. Retorna { received: true }  (siempre 200, MP no reintenta)
```

### 5. El admin gestiona la orden

```
PATCH /orders/:id/status  { status: "confirmed" | "dispatched" | "delivered" | "cancelled" }

  Máquina de estados válidas:
    PENDING   → CONFIRMED | CANCELLED
    CONFIRMED → DISPATCHED | CANCELLED
    DISPATCHED → DELIVERED
    DELIVERED  → (terminal)
    CANCELLED  → (terminal)

  Al pasar a DISPATCHED → handleDispatch():
    Transacción:
      Por cada OrderItem:
        StockItemsService.dispatchStock(productId, locationId, qty, orderId)
          → quantityCurrent  -= qty
          → quantityReserved -= qty
          → guarda StockMovementEntity (EXIT/OUTBOUND/ORDER)

  Al pasar a CANCELLED → handleCancellation():
    Transacción:
      Por cada OrderItem:
        StockItemsService.releaseReservation(productId, locationId, qty, orderId)
          → quantityReserved -= qty
          → guarda StockMovementEntity (RETURN/INBOUND/ORDER)
      Si había cupón:
          → coupon.usageCount--
          → CouponUsageEntity softDelete
```

---

## Gestión de Inventario

### Modelo de contadores

```
StockItemEntity
  quantityCurrent   → unidades físicas reales en el depósito
  quantityReserved  → bloqueadas por órdenes en estado PENDING/CONFIRMED
  quantityAvailable → getter: quantityCurrent - quantityReserved
```

### Ciclo de vida del stock en una orden

```
                  CREATE ORDER          DISPATCH         CANCEL
                       │                    │               │
quantityReserved   +quantity            -quantity        -quantity
quantityCurrent       (sin cambio)      -quantity        (sin cambio)
```

### Elección de ubicación

`findByProduct(productId)` devuelve el `StockItemEntity` con mayor `quantityAvailable` para ese producto. Las ubicaciones no se mezclan — cada order item se despacha desde una única ubicación.

`findByCombo(comboId)` calcula cuántos combos completos se pueden armar:
```
availableCombos = floor( min( stockDisponible_i / cantidadRequerida_i ) )
                  para cada componente del combo
```

---

## Patrones de Consistencia de Datos

### Transacciones atómicas

Todas las operaciones que tocan múltiples tablas usan `dataSource.transaction(manager => ...)`:

| Operación | Tablas involucradas |
|---|---|
| Crear orden | orders, order_items, stock_items, coupon_usages, coupons |
| Webhook pago aprobado | payments, orders |
| Webhook pago rechazado | payments, orders, stock_items, stock_movements, coupon_usages, coupons |
| Despachar orden | orders, stock_items, stock_movements |
| Cancelar orden | orders, stock_items, stock_movements, coupon_usages, coupons |

### Locks pesimistas

`FOR UPDATE` de PostgreSQL aplicado a través de TypeORM con `{ lock: { mode: 'pessimistic_write' } }`:

| Dónde | Qué lockea | Por qué |
|---|---|---|
| `OrdersService.create()` | `CouponEntity` | Evita que dos órdenes simultáneas excedan el límite de uso |
| `PaymentsService.create()` | `OrderEntity` | Evita crear dos pagos PENDING para la misma orden |
| `PaymentsService.handleWebhook()` | `PaymentEntity` + `OrderEntity` | MP puede enviar la misma notificación dos veces — idempotencia |
| `StockItemsService.*` | `StockItemEntity` | Evita race condition en reserva/despacho/liberación de stock |

### Soft delete

Todas las entidades extienden `BaseEntity` con `isDeleted: boolean`. Nunca se borra un registro físicamente. Excepción: `StockMovementEntity` y `StockWriteOffEntity` usan `BaseAuditEntity` (sin `isDeleted`) porque son logs inmutables.

### Snapshot de precios

Los `OrderItemEntity` guardan `unitPrice` y `finalPrice` al momento de crear la orden. Si después cambia el pricing de un producto, las órdenes históricas mantienen el precio original.

---

## Variables de Entorno

```properties
# Base de datos
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=

# Auth
JWT_SECRET=

# Superadmin (seed)
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=

# MercadoPago
MP_ACCESS_TOKEN=          # Token servidor — solo backend
MP_PUBLIC_KEY=            # Clave pública — puede ir al frontend
MP_NOTIFICATION_URL=      # URL pública del webhook (usar ngrok en dev)
MP_WEBHOOK_SECRET=        # HMAC-SHA256 secret — vacío omite la verificación en dev

# Email
RESEND_API_KEY=
MAIL_FROM=

# URLs
FRONTEND_URL=             # Para back_urls de MP y links en emails
API_URL=                  # Para el logo en templates de email
```

---

## Convenciones del Proyecto

### Entidades

- Extienden `BaseEntity` — heredan `id`, `createdAt`, `updatedAt`, `isDeleted`
- Snake_case en columnas DB (`@Column({ name: 'user_id' })`), camelCase en TypeScript
- FK declarada explícitamente como columna `@Column()` junto al `@ManyToOne()`
- `onDelete: 'RESTRICT'` en todas las relaciones ManyToOne salvo cascades intencionales
- `@Column({ type: 'decimal', transformer: ... })` para campos de dinero — evitar pérdida de precisión al leer de PostgreSQL

### Services

- Devuelven siempre DTOs de respuesta, nunca la entidad directa
- Método privado `findEntity(id)` para reutilizar lógica de búsqueda + `NotFoundException`
- Transacciones con `dataSource.transaction()` cuando se tocan múltiples tablas

### Controllers

- Guards a nivel de clase cuando todos los endpoints requieren el mismo acceso
- `@Roles()` + `@UseGuards(AuthGuard('jwt'), RolesGuard)` para endpoints de admin
- Rutas específicas **siempre antes** de rutas con parámetros (e.g., `GET /user/:userId` antes de `GET /:id`)

### DTOs

- `class-validator` para validación de todos los campos
- `@Type(() => Number)` en query params numéricos (`ValidationPipe` tiene `transform: true`)
- `PartialType` para update DTOs

### Tests

- Unit tests con mocks del repositorio — sin DB real
- Factory `mockEntity(overrides = {})` para datos de prueba
- `jest.clearAllMocks()` en `afterEach`
- `overrideGuard` para saltar autenticación en controller specs
- E2E tests con PostgreSQL real en Docker (puerto 5433), `dropSchema: true` por suite
- `maxWorkers: 1` en `jest-e2e.json` para evitar que los drops de schema se pisen entre sí

---

## Comandos Útiles

```bash
# Desarrollo
npm run start:dev

# Tests unitarios
npx jest
npx jest --testPathPattern="orders"
npx jest --coverage

# Tests e2e (requiere Docker)
docker compose up -d postgres_test
npx jest --config test/jest-e2e.json
npx jest --config test/jest-e2e.json --testPathPattern="payments"

# Build producción
npm run build
```

---

## Documentación por Módulo

Cada módulo tiene su propia documentación técnica y de negocio en `/documentation/`:

| Módulo | Doc técnica | Doc de negocio |
|---|---|---|
| Auth | [auth/auth.md](auth/auth.md) | [auth/auth_negocio.md](auth/auth_negocio.md) |
| Users | [users/users.md](users/users.md) | [users/users_negocio.md](users/users_negocio.md) |
| Products | [products/products.md](products/products.md) | [products/products_negocio.md](products/products_negocio.md) |
| Combos | [combos/combos.md](combos/combos.md) | [combos/combos_negocio.md](combos/combos_negocio.md) |
| Categories | [categories/categories.md](categories/categories.md) | [categories/categories_negocio.md](categories/categories_negocio.md) |
| Shop | [shop/shop.md](shop/shop.md) | [shop/shop_negocio.md](shop/shop_negocio.md) |
| Pricing | [pricing/pricing.md](pricing/pricing.md) | [pricing/pricing_negocio.md](pricing/pricing_negocio.md) |
| Margins | [margins/margins.md](margins/margins.md) | [margins/margins_negocio.md](margins/margins_negocio.md) |
| Discounts | [discounts/discounts.md](discounts/discounts.md) | [discounts/discounts_negocio.md](discounts/discounts_negocio.md) |
| Taxations | [taxations/taxations.md](taxations/taxations.md) | [taxations/taxations_negocio.md](taxations/taxations_negocio.md) |
| Coupons | [coupons/coupons.md](coupons/coupons.md) | [coupons/coupons_negocio.md](coupons/coupons_negocio.md) |
| Stocks | [stocks/stocks.md](stocks/stocks.md) | [stocks/stocks_negocio.md](stocks/stocks_negocio.md) |
| Orders | [orders/orders.md](orders/orders.md) | [orders/orders_negocio.md](orders/orders_negocio.md) |
| Payments | [payments/payments.md](payments/payments.md) | [payments/payments_negocio.md](payments/payments_negocio.md) |
| Mail | [mail/mail.md](mail/mail.md) | [mail/mail_negocio.md](mail/mail_negocio.md) |
| Seed | [seed/seed.md](seed/seed.md) | [seed/seed_negocio.md](seed/seed_negocio.md) |

---

## Notas de Operación

- `synchronize: true` activo en desarrollo — TypeORM sincroniza el schema automáticamente. **No usar en producción.**
- El webhook de MercadoPago siempre debe responder `200` — el service hace swallow de errores internos para evitar reintentos indefinidos de MP.
- El logo de email (`EMAIL_THEME.logo`) apunta a `API_URL/email/logo.png`. En desarrollo usar Cloudinary u otra URL pública accesible por el servidor de Resend.
- `forbidNonWhitelisted: true` en el `ValidationPipe` global — campos extra en el body generan `400`.
- El throttler global aplica a todos los endpoints excepto los decorados con `@SkipThrottle()` (webhook de MP).
