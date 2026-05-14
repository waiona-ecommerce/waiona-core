# Estado de Tests, Swagger y Plan de Continuación

> Fecha: 2026-05-14  
> Revisado por: Claude (análisis sobre rama master post-refactor)  
> Prerrequisito: ver `00_analisis_general_backend.md` para el listado completo de bugs y problemas de seguridad

---

## 1. Resumen Ejecutivo

El backend tiene **61 archivos de test unitarios** (100% de controllers y services cubiertos) pero con una calidad de cobertura que da **falsa seguridad**: los mocks no pueden detectar los bugs críticos de stock ni los problemas de transacción que ya están documentados. Los tests e2e existen solo para el módulo de taxation (2 archivos, 421 líneas). Swagger está completamente ausente — no hay ni el paquete instalado. El plan a seguir tiene tres frentes: **arreglar bugs críticos primero**, luego **e2e en módulos de negocio**, finalmente **Swagger**.

---

## 2. Estado Actual de los Tests

### 2.1 Tests Unitarios — Cantidad vs. Calidad

| Módulo | Controller spec | Service spec | Calidad estimada |
|--------|----------------|--------------|-----------------|
| auth | ✓ | ✓ | Media — no testea el flujo completo de JWT |
| users | ✓ | ✓ | Alta |
| products | ✓ × 3 | ✓ × 3 | Alta |
| combos | ✓ | ✓ | Alta |
| categories | ✓ | ✓ | Alta |
| pricing | ✓ × 3 | ✓ × 3 | Alta |
| calculation | — | ✓ | Alta |
| taxation | ✓ × 4 | ✓ × 4 | Alta |
| discounts | ✓ × 3 | ✓ × 3 | Alta |
| coupons | ✓ × 4 | ✓ × 4 | Media |
| stocks | ✓ × 4 | ✓ × 4 | Media — no detecta race conditions |
| margins | ✓ | ✓ | Alta |
| **orders** | ✓ | ✓ | **Baja — mock de DataSource oculta el bug de transacción** |
| **payments** | ✓ | ✓ | **Baja — mock de HMAC no verifica el flujo real** |
| seed | — | ✓ | Media |
| mail | — | ✓ | Baja — no testea templates ni integración con Resend |

**Total: 61 archivos .spec.ts** — pero cobertura de líneas ≠ cobertura de comportamiento.

### 2.2 Problemas Concretos en los Tests Existentes

#### El mock de DataSource oculta el bug más crítico

En `orders.service.spec.ts`:

```typescript
const mockDataSource = { transaction: jest.fn(cb => cb(mockEntityManager)) };
```

Este mock ejecuta el callback sincrónicamente, sin una DB real. El bug del stock (ver `00_analisis_general_backend.md` §3.1) es que `stockItemsService.reserveStock()` usa su **propio repositorio inyectado**, no el `EntityManager` de la transacción. El test no puede detectar esto porque el mock no diferencia entre el manager y el repositorio — ambos son jest.fn().

**Consecuencia:** los tests pasan en verde pero el bug existe en producción.

#### Los mocks no ejercitan las validaciones de negocio reales

Los unit tests prueban que el servicio llama a los métodos correctos con los parámetros correctos. No prueban:
- Que una orden con stock insuficiente genera 400 (no 500).
- Que un cupón expirado es rechazado con el mensaje correcto.
- Que dos requests concurrentes no pueden usar el mismo cupón de un solo uso.

#### Cobertura de ramas débil en orders y coupons

Los paths de error (cupón expirado, stock negativo, usuario inactivo, transición de estado inválida) están testeados con mocks que devuelven `null` o lanzan errores, pero no se verifica que la excepción resultante sea exactamente el HTTP status correcto con el mensaje esperado — eso lo valida el e2e.

### 2.3 Tests E2E — Estado Actual

| Módulo | E2E | Cobertura |
|--------|-----|-----------|
| app (health) | `app.e2e-spec.ts` | Solo `GET /` → 200 |
| tax-types | `taxation/tax-types.e2e-spec.ts` | CRUD completo + validaciones |
| taxes | `taxation/taxes.e2e-spec.ts` | CRUD completo + edge cases |
| **todos los demás** | ✗ | **Sin ningún test e2e** |

Los dos archivos de taxation son un buen modelo a seguir: usan SQLite in-memory, override de guards, `ValidationPipe` configurado igual que producción. El patrón está definido — solo falta aplicarlo a los módulos que importan.

---

## 3. Errores Pendientes de Implementación

### 3.1 Bugs críticos (de `00_analisis_general_backend.md`, no resueltos)

| # | Descripción | Archivo | Severidad |
|---|-------------|---------|-----------|
| B1 | `reserveStock` fuera de la transacción de orden | `orders.service.ts` ~L190 | **CRÍTICA** |
| B2 | Race condition TOCTOU en validación de cupón | `orders.service.ts` ~L140 | **CRÍTICA** |
| B3 | Dispatch/release usa ubicación incorrecta para combos | `orders.service.ts` `handleDispatch` | **Alta** |
| B4 | Ownership check ausente en `GET /orders/:id` | `orders.controller.ts` | **Alta** |
| B5 | Ownership check ausente en `GET /payments/:id` y `POST /payments` | `payments.controller.ts` | **Alta** |

### 3.2 Seguridad sin resolver

| # | Descripción | Estado actual |
|---|-------------|---------------|
| S1 | Rate limiting no configurado (throttler instalado pero no aplicado) | `@nestjs/throttler` está en deps, no hay `ThrottlerModule` en `AppModule` |
| S2 | Webhook secret bypass si `MP_WEBHOOK_SECRET` vacío en staging | `if (!secret) return;` en payments controller |
| S3 | JWT de 6 días sin revocación ni logout endpoint | Sin blacklist, sin refresh token |

### 3.3 Lo que falta implementar (funcionalidades)

| Feature | Estado | Prioridad |
|---------|--------|-----------|
| **Swagger/OpenAPI** | No iniciado. `@nestjs/swagger` no está en `package.json` | Alta |
| **E2E tests** para auth, orders, payments, shop | No iniciado | Alta |
| **E2E tests** para stocks, coupons, products | No iniciado | Media |
| **TypeORM migrations** | Scripts definidos, carpeta vacía | Media |
| **Logging estructurado** | Solo logger default de NestJS | Baja |
| **CORS fine-grained** | `origin: process.env.FRONTEND_URL` (correcto pero sin allowedHeaders ni methods explícitos) | Baja |

---

## 4. Riesgos Futuros

### 4.1 Stock negativo en producción (Riesgo Inmediato)

El bug B1 se activará cuando haya concurrencia moderada — 2 usuarios comprando el último item simultáneamente. No requiere carga alta. El primer incidente de stock negativo será difícil de rastrear sin un log de movimientos que muestre la secuencia exacta.

**Ventana de riesgo:** desde el primer día de tráfico real.

### 4.2 Cupones usados N veces por usuarios técnicos (Riesgo Inmediato)

El bug B2 puede ser explotado intencionalmente por usuarios que envíen múltiples requests simultáneas. Con un cupón de descuento del 50%, esto es un vector de fraude activo.

**Ventana de riesgo:** cualquier usuario que sepa hacer requests concurrentes.

### 4.3 Enumeración de órdenes y pagos (Riesgo de Privacidad)

Un cliente autenticado puede iterar IDs (`GET /orders/1`, `/orders/2`, etc.) y ver pedidos de otros usuarios, incluyendo datos personales de delivery. Con los pagos es igual. Esto es un problema de GDPR/privacidad, además de seguridad.

### 4.4 Deuda técnica en mocks que crece con el proyecto

Cada nuevo feature que se agregue a `orders.service.ts` va a necesitar más mocks. El test unitario de orders ya tiene 10 repositorios/servicios mockeados. Sin e2e que valide el flujo real, los tests se van a volver más frágiles y más desconectados del comportamiento real.

### 4.5 N+1 queries en Shop bajo carga (Riesgo de Performance)

Documentado en `00_` §5.1. Con 20 productos por página y 3-5 queries por producto (pricing, taxes, discounts, stock), son hasta 100 queries por request al shop. Invisible en desarrollo, crítico con tráfico real.

### 4.6 Sin migraciones → schema drift en producción

Con `synchronize: true` en dev, el schema de dev y producción pueden diverger silenciosamente. El día que se apague `synchronize` en prod y se quieran correr migraciones, no habrá una historia limpia de cómo llegó el schema a su estado actual.

---

## 5. Plan de Implementación

### Fase 1 — Bugs Críticos (hacerlo antes de lanzar)

Ningún test nuevo vale la pena antes de corregir lo que ya está roto.

#### 1.1 Fix stock reservation dentro de la transacción (B1)

En `orders.service.ts`, dentro del bloque `dataSource.transaction(async manager => {...})`, reemplazar la llamada a `this.stockItemsService.reserveStock()` por una operación directa usando el `manager`:

```typescript
// En vez de:
await this.stockItemsService.reserveStock(productId, locationId, qty);

// Dentro de la transacción:
const stockItem = await manager.findOne(StockItemEntity, {
  where: { productId, locationId, isDeleted: false },
  lock: { mode: 'pessimistic_write' },  // SELECT FOR UPDATE
});
if (!stockItem || stockItem.quantityAvailable < qty) throw new BadRequestException('Stock insuficiente');
stockItem.quantityReserved += qty;
await manager.save(StockItemEntity, stockItem);
```

#### 1.2 Fix TOCTOU en cupón (B2)

Mover toda la validación del cupón dentro de la transacción usando `SELECT FOR UPDATE`:

```typescript
const coupon = await manager.findOne(CouponEntity, {
  where: { code: couponCode, isDeleted: false },
  lock: { mode: 'pessimistic_write' },
});
// validar aquí dentro del manager
```

#### 1.3 Fix dispatch location para combos (B3)

En `handleDispatch` y `handleCancellation`, guardar `locationId` en `OrderItemEntity` al momento de la reserva para usarlo al despachar:

```typescript
// En OrderItemEntity agregar:
@Column({ nullable: true })
locationId: number;

// Al reservar: item.locationId = stockItem.locationId
// Al despachar: buscar por { productId, locationId: item.locationId }
```

#### 1.4 Ownership checks (B4, B5)

En `orders.controller.ts`:
```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
  return this.ordersService.findOne(id, req.user.sub, req.user.role);
}
```

Y en el servicio, verificar `order.userId === userId || role === RoleType.ADMIN`.

---

### Fase 2 — Tests E2E para Módulos de Negocio

Seguir el patrón de `test/taxation/` exactamente. Prioridad por impacto de negocio:

#### 2.1 Auth E2E (`test/auth/auth.e2e-spec.ts`)

| Caso | Descripción |
|------|-------------|
| `POST /auth/register` | Crea usuario inactivo, devuelve 201 |
| `POST /auth/register` duplicado | Devuelve 409 |
| `GET /auth/activate` token válido | Activa cuenta, 200 |
| `GET /auth/activate` token expirado | 400 |
| `POST /auth/login` cuenta inactiva | 401 |
| `POST /auth/login` credenciales ok | JWT en response, 200 |
| `POST /auth/forgot-password` email inexistente | 200 (no revelar) |
| `POST /auth/reset-password` token válido | Cambia password |

**Nota:** Mockear `MailService` para no llamar a Resend en tests.

#### 2.2 Orders E2E (`test/orders/orders.e2e-spec.ts`)

| Caso | Descripción |
|------|-------------|
| `POST /orders` items válidos, sin cupón | Crea orden, reserva stock, 201 |
| `POST /orders` stock insuficiente | 400 |
| `POST /orders` con cupón válido | Descuento aplicado correctamente |
| `POST /orders` cupón expirado | 400 |
| `PATCH /orders/:id/status` PENDING→CONFIRMED | Transición válida |
| `PATCH /orders/:id/status` DELIVERED→CANCELLED | 400 transición inválida |
| `PATCH /orders/:id/status` CONFIRMED→DISPATCHED | Stock real decrementado |
| `GET /orders/:id` orden de otro usuario | 403 (después del fix B4) |

**Este es el e2e más valioso** — es el único que puede detectar el bug B1 en una DB real.

#### 2.3 Shop E2E (`test/shop/shop.e2e-spec.ts`)

| Caso | Descripción |
|------|-------------|
| `GET /shop/items` sin auth | 200, lista de items |
| `GET /shop/items` con filtros de categoría | Filtra correctamente |
| `GET /shop/items/:id` | Devuelve precio calculado correcto |

#### 2.4 Stocks E2E (`test/stocks/stock-items.e2e-spec.ts`)

| Caso | Descripción |
|------|-------------|
| `POST /stock-items` | Crea stock en ubicación |
| `PATCH /stock-items/:id` | Actualiza cantidades |
| Stock negativo no permitido | 400 |

#### 2.5 Coupons E2E (`test/coupons/coupons.e2e-spec.ts`)

| Caso | Descripción |
|------|-------------|
| `POST /coupons` | Crea cupón con límite de uso |
| Cupón sin targets → aplicable a todo | Validar lógica |
| Cupón con targets → solo aplica a esos items | Validar lógica |

#### 2.6 Payments E2E (`test/payments/payments.e2e-spec.ts`)

| Caso | Descripción |
|------|-------------|
| `POST /payments/webhook` firma válida | Procesa y devuelve 200 |
| `POST /payments/webhook` firma inválida | 401 |
| `POST /payments/webhook` sin secret configurado | Comportamiento controlado |

---

### Fase 3 — Swagger/OpenAPI

#### 3.1 Instalación

```bash
npm install @nestjs/swagger swagger-ui-express
```

#### 3.2 Configuración en `main.ts`

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Waiona Core API')
  .setDescription('Backend de e-commerce/delivery Waiona')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

#### 3.3 Decoradores en DTOs

Prioridad: los DTOs más usados por el frontend.

```typescript
// Ejemplo en CreateOrderDto:
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({ example: 1, description: 'ID del producto (excluyente con comboId)' })
  @IsOptional()
  @IsInt()
  productId?: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}
```

#### 3.4 Decoradores en Controllers

```typescript
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  
  @ApiOperation({ summary: 'Crear orden con items y cupón opcional' })
  @ApiResponse({ status: 201, description: 'Orden creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Stock insuficiente o cupón inválido' })
  @Post()
  create(...) {}
}
```

#### 3.5 Módulos a documentar (orden por prioridad)

1. `auth` — endpoints públicos más usados
2. `shop` — endpoints del cliente
3. `orders` — flujo de compra
4. `payments` — webhook y estado de pago
5. `products`, `categories`, `combos` — gestión de catálogo
6. `stocks` — gestión de inventario
7. `pricing`, `taxation`, `discounts`, `coupons`, `margins` — configuración

---

### Fase 4 — Production Readiness (paralela a Fase 3)

#### 4.1 Activar ThrottlerModule

```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  name: 'short',
  ttl: 60000,
  limit: 10,  // 10 requests/minuto en endpoints de auth
}]),
```

Aplicar `@Throttle()` en `auth.controller.ts` en register, login, forgot-password.

#### 4.2 Iniciar TypeORM Migrations

```bash
npx typeorm migration:generate src/database/migrations/InitialSchema -d src/database/ormconfig.ts
```

Y luego desactivar `synchronize: true` en producción via variable de entorno:

```typescript
synchronize: process.env.NODE_ENV !== 'production',
```

#### 4.3 Logging estructurado

Agregar `pino` o `winston` para logs estructurados en JSON. Al menos loguear:
- Cada orden creada (con orderId, userId, total)
- Cada cambio de estado de orden
- Cada webhook de MercadoPago recibido (con paymentId y resultado)
- Errores de stock

---

## 6. Resumen Priorizado

```
URGENTE (antes de lanzar)
├── [B1] Fix reserveStock dentro de la transacción
├── [B2] Fix TOCTOU coupon con SELECT FOR UPDATE
├── [B3] Fix dispatch location para combos
├── [B4] Ownership check en GET /orders/:id
└── [B5] Ownership check en payments

ALTA (primera semana post-lanzamiento)
├── [E2E] Auth flows completos
├── [E2E] Orders — el más crítico para detectar regressions
├── [SWAGGER] Instalar y documentar auth + shop + orders
└── [SEC] Throttler en endpoints de auth

MEDIA (primer mes)
├── [E2E] Shop, stocks, payments
├── [SWAGGER] Resto de módulos
├── [DB] TypeORM migrations + deshabilitar synchronize en prod
└── [E2E] Coupons

BAJA (backlog)
├── Logging estructurado
├── Refresh tokens / logout
└── Optimizar N+1 queries en shop
```

---

## 7. Métricas Objetivo

| Métrica | Estado Actual | Objetivo |
|---------|---------------|----------|
| Archivos spec unitarios | 61/61 | Mantener, mejorar calidad |
| Archivos e2e | 2 con tests reales | 8+ (auth, orders, shop, payments, stocks, coupons, products) |
| Bugs críticos abiertos | 5 | 0 antes de producción |
| Swagger coverage | 0% endpoints | 100% endpoints públicos |
| Rate limiting activo | No | Sí en auth |
| Migrations en carpeta | 0 | Schema inicial + cada cambio futuro |
