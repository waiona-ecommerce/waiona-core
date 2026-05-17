# Taxation — Análisis Técnico Completo

## ¿Qué hace este módulo?

Gestiona todos los impuestos del sistema. Está dividido en cuatro sub-módulos independientes con sus propios controladores, servicios y entidades:

| Sub-módulo | Entidad | Ruta base |
|---|---|---|
| `tax-types` | `TaxTypeEntity` | `/tax-types` |
| `taxes` | `TaxEntity` | `/tax-types/:taxTypeId/taxes` |
| `product-taxes` | `ProductTaxEntity` | `/products/:productId/taxes` |
| `combo-taxes` | `ComboTaxEntity` | `/combos/:comboId/taxes` |

### Posición en el flujo de precios

```
unitPrice
  → aplicar descuento       → priceAfterDiscount
  → aplicar margen          → priceAfterMargin
  → aplicar impuestos       → finalPrice              ← acá actúa este módulo
  → aplicar cupón           → orderTotal
```

---

## Tipos de datos

### `TaxTypeEntity`

```typescript
{
  id:        number;       // PK autoincremental
  code:      string;       // varchar(20), único
  name:      string;       // varchar(150)
  deletedAt: Date | null;  // soft delete
  createdAt: Date;
  updatedAt: Date;
}
```

### `TaxEntity`

```typescript
{
  id:           number;          // PK autoincremental
  taxTypeId:    number;          // FK → tax_types.id (RESTRICT)
  value:        number;          // decimal(10,2) — viene como string de PG, convertir con Number()
  isPercentage: boolean;
  currency:     CurrencyCode | null;  // solo si !isPercentage → 'ARS'
  isGlobal:     boolean;         // default false
  deletedAt:    Date | null;
  createdAt:    Date;
  updatedAt:    Date;
}
```

### `ProductTaxEntity`

```typescript
{
  id:        number;  // PK autoincremental
  productId: number;  // FK → products.id (CASCADE)
  taxId:     number;  // FK → taxes.id (CASCADE)
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
// @Index(['productId', 'taxId'], { unique: true })
```

### `ComboTaxEntity`

```typescript
{
  id:        number;  // PK autoincremental
  comboId:   number;  // FK → combos.id (CASCADE)
  taxId:     number;  // FK → taxes.id (CASCADE)
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
// @Index(['comboId', 'taxId'], { unique: true })
```

---

## DTOs

### Tax Types

**`CreateTaxTypeDto`**
```typescript
{
  code: string;  // 2–20 chars, requerido
  name: string;  // 3–150 chars, requerido
}
```

**`UpdateTaxTypeDto`** — `PartialType(CreateTaxTypeDto)`

**`TaxTypeResponseDto`**
```typescript
{
  id:        number;
  code:      string;
  name:      string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Taxes

**`CreateTaxDto`**
```typescript
{
  value:        number;          // >= 0, máx 2 decimales
  isPercentage: boolean;         // requerido
  currency?:    CurrencyCode;    // requerido si !isPercentage
  isGlobal?:    boolean;         // default false
}
```

**`UpdateTaxDto`** — `PartialType(CreateTaxDto)`

**`TaxResponseDto`**
```typescript
{
  id:           number;
  taxTypeId:    number;
  value:        number;          // Number(entity.value) — fix decimal de PG
  isPercentage: boolean;
  currency?:    CurrencyCode;
  isGlobal:     boolean;
  createdAt:    Date;
  updatedAt:    Date;
  taxType?:     TaxTypeResponseDto;  // presente cuando se carga la relación
}
```

### Product Taxes / Combo Taxes

**`CreateProductTaxDto`** / **`CreateComboTaxDto`**
```typescript
{
  taxId: number;  // >= 1, requerido
}
```

**`UpdateProductTaxDto`** / **`UpdateComboTaxDto`** — `PartialType(Create...Dto)`

**`ProductTaxResponseDto`**
```typescript
{
  id:        number;
  productId: number;
  taxId:     number;
  createdAt: Date;
  updatedAt: Date;
}
```

**`ComboTaxResponseDto`**
```typescript
{
  id:        number;
  comboId:   number;
  taxId:     number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Endpoints

Todos requieren JWT con rol `SUPER_ADMIN` o `ADMIN`.

### Tax Types — `GET /tax-types`

Lista paginada de tipos de impuesto.

**Query params** (opcionales): `page` (default: 1), `limit` (default: 20)

**Response 200:**
```json
{
  "data": [{ "id": 1, "code": "IVA", "name": "Impuesto al Valor Agregado", "createdAt": "...", "updatedAt": "..." }],
  "total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNextPage": false
}
```

### Tax Types — `GET /tax-types/:id`

**Response 200:** `TaxTypeResponseDto` | **404** si no existe.

### Tax Types — `POST /tax-types`

```json
{ "code": "IVA", "name": "Impuesto al Valor Agregado" }
```

**Response 201:** `TaxTypeResponseDto`
**Errores:** `400` — code duplicado o validación fallida.

### Tax Types — `PATCH /tax-types/:id`

Actualización parcial. **Errores:** `400` — code duplicado | `404` — no encontrado.

### Tax Types — `DELETE /tax-types/:id`

**Response 204.** **Errores:** `404` — no encontrado.

---

### Taxes — `GET /tax-types/:taxTypeId/taxes`

Lista todos los impuestos de un tipo. **Response 200:** `TaxResponseDto[]`.

### Taxes — `GET /tax-types/:taxTypeId/taxes/:id`

**Response 200:** `TaxResponseDto` | **404** si no existe.

### Taxes — `POST /tax-types/:taxTypeId/taxes`

```json
{ "value": 21, "isPercentage": true }
```
```json
{ "value": 50, "isPercentage": false, "currency": "ARS" }
```

**Response 201:** `TaxResponseDto`

**Errores:**
- `400` — `taxTypeId` no existe
- `400` — `!isPercentage` sin `currency`
- `400` — `isPercentage` con `currency`
- `400` — `value` negativo

### Taxes — `PATCH /tax-types/:taxTypeId/taxes/:id`

Actualización parcial. Revalida consistencia `isPercentage` / `currency` con el estado resultante.

**Errores:** `400` — inconsistencia porcentaje/moneda | `404` — no encontrado.

### Taxes — `DELETE /tax-types/:taxTypeId/taxes/:id`

**Response 204.** **Errores:** `404` — no encontrado.

---

### Product Taxes — `GET /products/:productId/taxes`

Lista todos los impuestos asignados al producto. **Response 200:** `ProductTaxResponseDto[]`.

### Product Taxes — `GET /products/:productId/taxes/:id`

**Response 200:** `ProductTaxResponseDto` | **404** si no existe.

### Product Taxes — `POST /products/:productId/taxes`

```json
{ "taxId": 1 }
```

**Response 201:** `ProductTaxResponseDto`

**Errores:**
- `404` — `taxId` no existe
- `400` — el impuesto es global (ya aplica a todo)

### Product Taxes — `PATCH /products/:productId/taxes/:id`

**Response 200.** **Errores:** `404` — no encontrado.

### Product Taxes — `DELETE /products/:productId/taxes/:id`

**Response 204.** **Errores:** `404` — no encontrado.

---

### Combo Taxes

Idéntico a Product Taxes con `/combos/:comboId/taxes` y `ComboTaxResponseDto`.

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| `code` único en `tax_types` | `create` y `update` cuando cambia el code |
| Si `!isPercentage` → `currency` requerida | `create` y `update` de taxes |
| Si `isPercentage` → `currency` prohibida | `create` y `update` de taxes |
| `taxTypeId` debe existir al crear un tax | `create` de taxes |
| Un impuesto global no puede asignarse a producto/combo | `create` de product-taxes y combo-taxes |
| Soft delete en todas las entidades | `softDelete(id)` — `deletedAt IS NULL` filtrado automáticamente |

---

## Estructura del módulo

```
src/modules/taxation/
├── taxation.module.ts
├── tax-types/
│   ├── controllers/tax-types.controller.ts
│   ├── services/tax-types.service.ts
│   ├── entities/tax-types.entity.ts
│   └── dto/  create · update · response
├── taxes/
│   ├── controllers/taxes.controller.ts
│   ├── services/taxes.service.ts
│   ├── entities/tax.entity.ts
│   └── dto/  create · update · response
├── product-taxes/
│   ├── controllers/product-taxes.controller.ts
│   ├── services/product-taxes.service.ts
│   ├── entities/product-taxes.entity.ts
│   └── dto/  create · update · response
└── combo-taxes/
    ├── controllers/combo-taxes.controller.ts
    ├── services/combo-taxes.service.ts
    ├── entities/combo-taxes.entity.ts
    └── dto/  create · update · response
```

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Entidades extienden `BaseEntity` con `@DeleteDateColumn` | ✅ |
| Soft delete vía `repo.softDelete(id)` | ✅ |
| Services retornan DTOs, nunca entidades | ✅ |
| `ParseIntPipe` en todos los params de ID | ✅ |
| Guards a nivel de clase | ✅ |
| `PartialType` de `@nestjs/swagger` en todos los UpdateDto | ✅ |
| `Number(entity.value)` en `TaxResponseDto` — fix decimal de PG | ✅ |
| `@HttpCode(204)` en todos los DELETE | ✅ |
| `GuardsModule` no importado en el módulo | ✅ |
| Helper `findEntity` privado en cada service | ✅ |
| `tax_type_id` como `name` en `@Column` y `@JoinColumn` | ✅ |
| Unit tests — mocks con `softDelete`, `findAndCount`, `deletedAt: null` | ✅ |
| E2E tests — PostgreSQL real, `dropSchema: true` | ✅ |
| Swagger — `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiParam` | ✅ |
| Swagger — `@ApiProperty` en todos los DTOs | ✅ |

---

## Tests

### Unit tests

```bash
npx jest --testPathPattern="taxation" --no-coverage
```

| Suite | Tests |
|---|---|
| `tax-types.service.spec.ts` | findAll, findById, create, update, delete — happy path + 400/404 |
| `tax-types.controller.spec.ts` | delegación por endpoint |
| `taxes.service.spec.ts` | findAll, findById, create, update, delete — happy path + 400/404 |
| `taxes.controller.spec.ts` | delegación por endpoint |
| `product-taxes.service.spec.ts` | create, findAll, findOne, update, remove — happy path + 400/404 |
| `product-taxes.controller.spec.ts` | delegación por endpoint |
| `combo-taxes.service.spec.ts` | create, findAll, findOne, update, remove — happy path + 400/404 |
| `combo-taxes.controller.spec.ts` | delegación por endpoint |

**Total: 71 unit tests — 8 suites.**

### E2E tests

```bash
# Requiere la DB de test corriendo en puerto 5433
npx jest --config test/jest-e2e.json --testPathPattern="taxation" --runInBand
```

| Suite | Tests |
|---|---|
| `tax-types.e2e-spec.ts` | 10 |
| `taxes.e2e-spec.ts` | 12 |
| `product-taxes.e2e-spec.ts` | 12 — seed via `dataSource.manager.save` |
| `combo-taxes.e2e-spec.ts` | 12 — seed via `dataSource.manager.save` |

**Total: 46 e2e tests — 4 suites.**

> `product-taxes` y `combo-taxes` incluyen en el schema todas las entidades del árbol de dependencias de `ProductEntity` / `ComboEntity` para satisfacer el validador de metadata de TypeORM: `ProductImageEntity`, `ComboItemEntity`, `ComboImageEntity`, `CategoryEntity`.

---

## Swagger

Disponible en `/api/docs` una vez corriendo la app.

| Módulo | Tag | Decoradores |
|---|---|---|
| Tax Types | `Tax Types` | `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` |
| Taxes | `Taxes` | ídem + `@ApiParam({ name: 'taxTypeId' })` |
| Product Taxes | `Product Taxes` | ídem + `@ApiParam({ name: 'productId' })` |
| Combo Taxes | `Combo Taxes` | ídem + `@ApiParam({ name: 'comboId' })` |

---

## Integración con otros módulos

```
TaxationModule
  ├── exporta TaxTypeEntity, TaxEntity, ProductTaxEntity, ComboTaxEntity
  └── consumido por pricing/calculation/
        └── CalculationService
              ├── lee taxes con isGlobal = true  → aplica a todos
              └── lee product_taxes / combo_taxes → aplica los específicos
```
