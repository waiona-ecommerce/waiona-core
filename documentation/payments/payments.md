# Payments — Análisis Técnico Completo

## ¿Qué es el módulo payments?

El módulo de pagos gestiona la integración con MercadoPago y el ciclo de vida de cada intento de pago asociado a una orden. Cuando un cliente quiere abonar una orden en estado `PENDING`, este módulo crea una preferencia en MP, devuelve la URL de checkout y luego escucha el webhook de notificación para actualizar el estado del pago y de la orden automáticamente.

```
POST   /payments                          → cliente crea pago para una orden PENDING
POST   /payments/webhook/mercadopago      → webhook público — MP notifica resultado (siempre 200)
GET    /payments/order/:orderId           → lista pagos de una orden
GET    /payments/:id                      → obtiene un pago por id
```

### Flujo completo

```
Cliente → POST /payments { orderId, provider }
            ↓ lock pesimista en orden
            ↓ valida PENDING + sin pago activo
            ↓ MercadoPagoProvider.createPreference(order)
            ↓ guarda PaymentEntity { status: PENDING, externalId, checkoutUrl }
            ↓ devuelve { checkoutUrl }
            ↓
          Cliente redirige a MP → procesa el pago
            ↓
          MP llama POST /payments/webhook/mercadopago
            ↓ verifica firma HMAC-SHA256 (x-signature)
            ↓ fetch Payment o MerchantOrder desde MP API
            ↓ mapea order_status → PaymentStatus + OrderStatus
            ↓ lock pesimista en payment + order
            ↓ guarda cambios en transacción
            ↓ si orden cancelada → releaseStockForOrder()
            ↓ retorna 200 (siempre)
```

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Cliente quiere pagar una orden | Orden creada → cliente inicia pago → recibe URL de MP |
| MP confirma el pago | Webhook `paid` → orden pasa a CONFIRMED automáticamente |
| Cliente abandona el pago | Webhook `expired` → pago REJECTED, orden CANCELLED, stock liberado |
| Contracargo o reversión | Webhook `reverted`/`charged_back` → pago CANCELLED, orden CANCELLED |
| Admin consulta el historial de pagos | `GET /payments/order/:orderId` |

---

## Tipos de datos

### `PaymentEntity`

```typescript
{
  id:           number;               // PK autoincrement (BaseEntity)
  createdAt:    Date;
  updatedAt:    Date;
  isDeleted:    boolean;              // soft delete (BaseEntity)

  orderId:      number;               // FK → orders.id (RESTRICT), index
  order:        OrderEntity;          // ManyToOne, onDelete: RESTRICT

  provider:     PaymentProvider;      // enum: MERCADOPAGO
  status:       PaymentStatus;        // enum: PENDING | APPROVED | REJECTED | CANCELLED

  externalId?:  string | null;        // varchar(255) — preference id de MP
  checkoutUrl?: string | null;        // varchar(500) — init_point de MP
  amount:       number;               // decimal(12,2) — convertido a number en DTO

  metadata?:    Record<string, any> | null; // jsonb — body + query del webhook recibido
}
```

Índices adicionales: `@Index(['orderId'])`, `@Index(['externalId'])`.

### `PaymentStatus` (enum)

| Valor | Significado |
|---|---|
| `PENDING` | Pago iniciado — cliente aún no completó el flujo en MP |
| `APPROVED` | MP confirmó el pago exitosamente |
| `REJECTED` | MP rechazó o expiró el pago |
| `CANCELLED` | Pago revertido o contracargo |

### `PaymentProvider` (enum)

| Valor | Significado |
|---|---|
| `MERCADOPAGO` | Único proveedor activo |

### Request: crear pago (`CreatePaymentDto`)

```typescript
{
  orderId:  number;          // @IsInt @Min(1) — id de la orden a pagar
  provider: PaymentProvider; // @IsEnum(PaymentProvider) — solo MERCADOPAGO por ahora
}
```

### Response (`PaymentResponseDto`)

```typescript
{
  id:           number;
  orderId:      number;
  provider:     PaymentProvider;
  status:       PaymentStatus;
  externalId?:  string | null;   // preference id de MP
  checkoutUrl?: string | null;   // URL de checkout — el cliente redirige aquí
  amount:       number;          // decimal(12,2) de PG → number (transformer en entidad)
  createdAt:    Date;
  updatedAt:    Date;
}
```

No hay UpdateDto — los pagos no se modifican desde la API; solo los actualiza el webhook.

---

## Endpoints

### `POST /payments`

Crea un pago para una orden en estado `PENDING`. Requiere JWT. El cliente solo puede pagar sus propias órdenes; el admin puede pagar cualquier orden.

**Request**
```json
{
  "orderId": 42,
  "provider": "mercadopago"
}
```

**Response `201`**
```json
{
  "id": 7,
  "orderId": 42,
  "provider": "mercadopago",
  "status": "pending",
  "externalId": "1234567890-abcd-...",
  "checkoutUrl": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890-abcd-...",
  "amount": 4950,
  "createdAt": "2025-05-20T14:00:00.000Z",
  "updatedAt": "2025-05-20T14:00:00.000Z"
}
```

**Errores posibles**

| Código | Motivo |
|---|---|
| `400` | La orden no está en estado `PENDING` |
| `400` | La orden ya tiene un pago en estado `PENDING` |
| `400` | Body inválido (falta `orderId` o `provider`) |
| `401` | Token JWT ausente o inválido |
| `403` | Cliente intenta pagar la orden de otro usuario |
| `404` | Orden no encontrada |

---

### `POST /payments/webhook/mercadopago`

Endpoint público (sin JWT). MercadoPago llama a este endpoint tras procesar un pago. Siempre retorna `200` — si retorna otro código, MP reintenta indefinidamente. Decorado con `@SkipThrottle()` para no ser limitado por el rate limiter global.

**Verificación de firma:** si `MP_WEBHOOK_SECRET` está configurado, valida `x-signature` con HMAC-SHA256. Si el secret no está (entorno dev), se omite la verificación.

**Mapeo de estados MP → sistema**

| `topic` | `order_status` / `status` de MP | `PaymentStatus` | `OrderStatus` |
|---|---|---|---|
| `merchant_order` | `paid` | `APPROVED` | `CONFIRMED` |
| `merchant_order` | `reverted` / `charged_back` | `CANCELLED` | `CANCELLED` |
| `merchant_order` | `payment_required` / `payment_in_process` | `PENDING` | sin cambio |
| `merchant_order` | `expired` / otros | `REJECTED` | `CANCELLED` |
| `payment` | `approved` | `APPROVED` | `CONFIRMED` |
| `payment` | `refunded` / `charged_back` | `CANCELLED` | `CANCELLED` |
| `payment` | `in_process` / `pending` | `PENDING` | sin cambio |
| `payment` | otros | `REJECTED` | `CANCELLED` |

Cuando la orden pasa a `CANCELLED`, se llama a `OrdersService.releaseStockForOrder()` dentro de la misma transacción.

**Query params recibidos de MP**
```
?topic=merchant_order&id=123456789
?type=payment&data.id=987654321
```

**Response `200`**
```json
{ "received": true }
```

**Errores posibles**

| Código | Motivo |
|---|---|
| `401` | Firma `x-signature` inválida (solo si `MP_WEBHOOK_SECRET` está configurado) |

---

### `GET /payments/order/:orderId`

Lista todos los pagos de una orden, ordenados por `createdAt DESC`. Requiere JWT.

- **Admin**: puede ver los pagos de cualquier orden. Si la orden no existe, retorna `[]` (sin 404).
- **Cliente**: solo puede ver pagos de sus propias órdenes; lanza `404` si la orden no existe y `403` si es de otro usuario.

**Response `200`**
```json
[
  {
    "id": 7,
    "orderId": 42,
    "provider": "mercadopago",
    "status": "approved",
    "externalId": "1234567890-abcd-...",
    "checkoutUrl": "https://www.mercadopago.com.ar/checkout/...",
    "amount": 4950,
    "createdAt": "2025-05-20T14:00:00.000Z",
    "updatedAt": "2025-05-20T14:01:30.000Z"
  }
]
```

**Errores posibles**

| Código | Motivo |
|---|---|
| `401` | Token JWT ausente o inválido |
| `403` | Cliente accede a pagos de orden de otro usuario |
| `404` | Orden no encontrada (solo path de cliente) |

---

### `GET /payments/:id`

Obtiene un pago por su id. Requiere JWT. El cliente solo puede ver pagos de sus propias órdenes (carga la relación `order` para verificar `order.userId`).

**Response `200`**
```json
{
  "id": 7,
  "orderId": 42,
  "provider": "mercadopago",
  "status": "approved",
  "externalId": "1234567890-abcd-...",
  "checkoutUrl": "https://www.mercadopago.com.ar/checkout/...",
  "amount": 4950,
  "createdAt": "2025-05-20T14:00:00.000Z",
  "updatedAt": "2025-05-20T14:01:30.000Z"
}
```

**Errores posibles**

| Código | Motivo |
|---|---|
| `401` | Token JWT ausente o inválido |
| `403` | Cliente accede a pago de orden de otro usuario |
| `404` | Pago no encontrado |

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| La orden debe estar en `PENDING` para poder crear un pago | `PaymentsService.create()` |
| No puede haber dos pagos en estado `PENDING` para la misma orden | `PaymentsService.create()` |
| Lock pesimista en `create` — el segundo request concurrente verá el pago ya existente | `PaymentsService.create()` — `findOne(..., { lock: pessimistic_write })` |
| El monto se guarda como entero en MP (`Math.round`) — MP no acepta decimales | `MercadoPagoProvider.createPreference()` |
| Las URLs de MP siempre vienen de variables de entorno | `MercadoPagoProvider.createPreference()` |
| El webhook siempre retorna 200 — los errores internos se swallow en `try/catch` | `PaymentsService.handleMercadoPagoWebhook()` |
| Lock pesimista en webhook — dos notificaciones simultáneas del mismo pago no generan race condition | `PaymentsService.handleMercadoPagoWebhook()` |
| Al cancelar una orden desde el webhook, se libera el stock reservado | `OrdersService.releaseStockForOrder()` dentro de la transacción |
| Si la orden ya está `CONFIRMED` y llega otro `paid`, no se vuelve a confirmar (idempotente) | Guarda `if (orderStatus === PENDING)` antes de setear CONFIRMED |

---

## Variables de entorno requeridas

| Variable | Uso |
|---|---|
| `MP_ACCESS_TOKEN` | Token servidor de MP — solo en backend, nunca en cliente |
| `MP_PUBLIC_KEY` | Clave pública de MP — puede exponerse al frontend |
| `MP_NOTIFICATION_URL` | URL pública del webhook (requiere ngrok en dev) |
| `MP_WEBHOOK_SECRET` | Secret para verificar firma HMAC-SHA256 — vacío en dev omite la verificación |
| `FRONTEND_URL` | Base URL para `back_urls` de la preferencia MP |

---

## Cumplimiento con agent skills

### `mercadopago-payments`

| Regla | Estado |
|---|---|
| URLs desde env (`FRONTEND_URL`, `MP_NOTIFICATION_URL`) | ✅ |
| Webhook siempre 200 (`@HttpCode(OK)` + swallow en service) | ✅ |
| Verificación de firma HMAC-SHA256 | ✅ |
| Manejo de todos los estados MP (`paid`, `reverted`, `charged_back`, `payment_in_process`, `expired`) | ✅ |
| Monto como entero (`Math.round(Number(order.total))`) | ✅ |

### `nestjs-core` + `typeorm-standard`

| Convención | Estado |
|---|---|
| Entidad extiende `BaseEntity` | ✅ |
| Snake_case en columnas DB, camelCase en TypeScript | ✅ |
| Service devuelve DTO, nunca la entidad directa | ✅ |
| Transacciones con `dataSource.transaction()` | ✅ |
| Guards a nivel de método (`@UseGuards(AuthGuard('jwt'))`) | ✅ |
| `ParseIntPipe` en params numéricos | ✅ |
| Swagger en todos los endpoints (`@ApiOperation`, `@ApiResponse`) | ✅ |
| `@SkipThrottle()` en webhook | ✅ |

---

## Tests

### Unit tests

```bash
npx jest --testPathPattern="payments" --no-coverage
```

| Suite | Tests | Qué cubre |
|---|---|---|
| `PaymentsService` — `create` | 5 | Creación exitosa, orden no encontrada, orden no PENDING, acceso denegado, pago duplicado |
| `PaymentsService` — `handleMercadoPagoWebhook` | 4 + 10 | Early returns, swallow de errores, mapeo de estados (merchant_order + payment topic completos) |
| `PaymentsService` — `findByOrder` | 5 | Admin, vacío, cliente con propia orden, 404 y 403 para cliente |
| `PaymentsService` — `findOne` | 4 | Admin, not found, cliente propia orden, 403 |
| `PaymentsController` | 8 | Delegación al service, firma MP válida/inválida/omitida |

> El mapeo de estados del webhook se testea en unit tests (no en e2e) porque requiere mockear los constructores de `Payment` y `MerchantOrder` del SDK de MP a nivel de módulo con `jest.mock('mercadopago', ...)`. El e2e no puede reproducir respuestas reales de la API de MP sin acceso de red.

### E2E tests

```bash
# Requiere Docker corriendo
docker compose up -d postgres_test
npx jest --config test/jest-e2e.json --testPathPattern="payments"
```

| Caso | Código esperado |
|---|---|
| `POST /payments` — orden PENDING con MercadoPago | `201` |
| `POST /payments` — orden ya tiene pago PENDING | `400` |
| `POST /payments` — orden no está en PENDING | `400` |
| `POST /payments` — cliente paga orden de otro usuario | `403` |
| `POST /payments` — orden no encontrada | `404` |
| `POST /payments` — body inválido (sin provider) | `400` |
| `POST /payments/webhook/mercadopago` — sin id en query | `200` |
| `POST /payments/webhook/mercadopago` — topic desconocido | `200` |
| `POST /payments/webhook/mercadopago` — topic=merchant_order, MP API falla | `200` |
| `POST /payments/webhook/mercadopago` — topic=payment, MP API falla | `200` |
| `GET /payments/order/:orderId` — admin ve pagos | `200` |
| `GET /payments/order/:orderId` — cliente ve pagos de su orden | `200` |
| `GET /payments/order/:orderId` — admin con orderId inexistente → array vacío | `200` |
| `GET /payments/order/:orderId` — cliente accede a orden de otro usuario | `403` |
| `GET /payments/order/:orderId` — orden no encontrada (cliente) | `404` |
| `GET /payments/:id` — admin obtiene pago | `200` |
| `GET /payments/:id` — cliente ve su propio pago | `200` |
| `GET /payments/:id` — cliente accede a pago de otro usuario | `403` |
| `GET /payments/:id` — pago no encontrado | `404` |

---

## Integración con otros módulos

```
┌─────────────────────────────────────────────────────────┐
│                    PaymentsModule                        │
│                                                         │
│  PaymentsController  →  PaymentsService                 │
│                              │                          │
│                    MercadoPagoProvider                  │
│                    (crea preferencias MP)               │
└─────────────┬───────────────┬─────────────┬────────────┘
              │               │             │
              ▼               ▼             ▼
       OrderEntity      OrdersService    PaymentEntity
    (valida estado,    (releaseStock    (repo propio)
     lee total)        en cancelación)

OrdersModule ──→ PaymentsModule
  La orden debe existir y estar PENDING para crear un pago.
  Al cancelar por webhook, PaymentsService llama a
  OrdersService.releaseStockForOrder() para liberar reservas.

PaymentsModule no es consumido por ningún otro módulo.
Es el punto final del flujo cliente → orden → pago.
```
