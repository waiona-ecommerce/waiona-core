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
│   ├── entities/base.entity.ts           → id, createdAt, updatedAt, isDeleted
│   ├── entities/base.audit.entity.ts     → sin isDeleted, solo auditoría
│   ├── enums/currency-code.enum.ts
│   ├── enums/role-type.enum.ts           → SUPER_ADMIN | ADMIN | CLIENT
│   ├── guards/roles.guard.ts             → lee rol del JWT payload, sin DB query
│   ├── guards/guards.module.ts
│   └── theme/email-theme.ts             → colores y logo para templates de email
│
├── modules/
│   ├── auth/                             → login, register, activate, forgot/reset password
│   ├── users/                            → CRUD usuarios, búsqueda por email/nombre
│   ├── seed/                             → crea roles base y superadmin al arrancar
│   ├── mail/                             → servicio de email con Resend
│   │   ├── entities/token.entity.ts      → tokens de activación y reset
│   │   └── templates/                   → HTML templates de email
│   ├── products/
│   │   ├── product/                      → CRUD productos (requiere categoryId)
│   │   ├── combos/                       → CRUD combos (items + categoryId)
│   │   ├── categories/                   → árbol de categorías padre/hijo
│   │   ├── product-images/              → imágenes ordenadas por position
│   │   ├── combo-images/                → imágenes de combos
│   │   └── shop/                         → endpoints públicos para el cliente
│   ├── pricing/
│   │   ├── (product|combo)-pricing/     → precio base, margen y moneda
│   │   └── calculation/                 → motor de cálculo de precios
│   ├── taxation/
│   │   ├── taxes/                        → impuestos globales
│   │   ├── tax-types/                   → tipos de impuesto (IVA, IIBB, etc.)
│   │   ├── product-taxes/               → impuestos específicos por producto
│   │   └── combo-taxes/                 → impuestos específicos por combo
│   ├── margins/                          → márgenes de ganancia
│   ├── discounts/
│   │   ├── discount/                     → descuentos con fechas y valor
│   │   ├── discount-product-target/     → descuento asignado a producto
│   │   └── discount-combo-target/       → descuento asignado a combo
│   ├── coupons/
│   │   ├── coupon/                       → códigos de cupón con límite de uso
│   │   ├── coupon-product-target/       → cupón para producto específico
│   │   ├── coupon-combo-target/         → cupón para combo específico
│   │   └── usage/                        → registro de usos con transacción
│   ├── stocks/
│   │   ├── stock-item/                  → stock por producto+ubicación
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
POST /auth/register     → crea usuario inactivo → envía email de activación
GET  /auth/activate     → activa la cuenta con token
POST /auth/login        → valida credenciales + isActive → devuelve JWT
POST /auth/forgot-password → envía email de reset
POST /auth/reset-password  → valida token y cambia password
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

### DTOs
- `class-validator` para validación
- `@Type(() => Number)` en query params numéricos (el ValidationPipe tiene `transform: true`)
- `PartialType` para update DTOs

### Tests
- Unit tests con mocks del repositorio (sin DB real)
- Factory functions `mockEntity(overrides = {})` para datos de prueba
- `jest.clearAllMocks()` en `afterEach`
- `overrideGuard` para saltar autenticación en controller specs

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
```

---

## Notas Importantes

- `synchronize: true` está activo en desarrollo — TypeORM sincroniza el schema automáticamente. **NO usar en producción.**
- El logo del email (`EMAIL_THEME.logo`) apunta a `API_URL/email/logo.png`. En desarrollo usar Cloudinary u otra URL pública.
- El webhook de MercadoPago siempre debe responder 200 — el service swallow errores internamente.
- `forbidNonWhitelisted: true` en el `ValidationPipe` — campos extra en el body generan 400.