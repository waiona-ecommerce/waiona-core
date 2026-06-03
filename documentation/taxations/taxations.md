# Taxation — Análisis Técnico Completo

## ¿Qué hace este módulo?

Gestiona todos los impuestos del sistema. Está dividido en tres sub-módulos independientes con sus propios controladores, servicios y entidades:

| Sub-módulo | Entidad | Ruta base |
|---|---|---|
| `tax-types` | `TaxTypeEntity` | `/tax-types` |
| `taxes` | `TaxEntity` | `/tax-types/:taxTypeId/taxes` |
| `product-taxes` | `ProductTaxEntity` | `/products/:productId/taxes` |

> **No existe `combo-taxes`.** Los impuestos de un combo se derivan automáticamente de los impuestos de sus productos componentes mediante prorrateo lineal (ver sección _Prorrateo en combos_).

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
  id:        number;       // PK autoincremental
  taxTypeId: number;       // FK → tax_types.id (RESTRICT)
  value:     number;       // decimal(10,2) — 0.01 a 100 (siempre porcentaje)
  isGlobal:  boolean;      // default false
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

> **Todos los impuestos son porcentuales.** Los impuestos de monto fijo (tasas municipales, etc.) operan a nivel de orden, no de producto, y no están modelados en este módulo.

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
  value:     number;   // >= 0.01 y <= 100, máx 2 decimales (siempre porcentaje)
  isGlobal?: boolean;  // default false
}
```

**`UpdateTaxDto`** — `PartialType(CreateTaxDto)`

**`TaxResponseDto`**
```typescript
{
  id:        number;
  taxTypeId: number;
  value:     number;   // Number(entity.value) — fix decimal de PG
  isGlobal:  boolean;
  createdAt: Date;
  updatedAt: Date;
  taxType?:  TaxTypeResponseDto;  // presente cuando se carga la relación
}
```

### Product Taxes

**`CreateProductTaxDto`**
```typescript
{
  taxId: number;  // >= 1, requerido
}
```

**`UpdateProductTaxDto`** — `PartialType(CreateProductTaxDto)`

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

Lista paginada de impuestos de un tipo.

**Query params** (opcionales): `page` (default: 1), `limit` (default: 20, máx: 100)

**Response 200:**
```json
{
  "data": [{ "id": 1, "taxTypeId": 1, "value": 21, "isGlobal": false, "createdAt": "...", "updatedAt": "..." }],
  "total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNextPage": false
}
```

### Taxes — `GET /tax-types/:taxTypeId/taxes/:id`

**Response 200:** `TaxResponseDto` | **404** si no existe.

### Taxes — `POST /tax-types/:taxTypeId/taxes`

```json
{ "value": 21 }
```
```json
{ "value": 3, "isGlobal": false }
```

**Response 201:** `TaxResponseDto`

**Errores:**
- `404` — `taxTypeId` no existe
- `400` — `value < 0.01` o `value > 100`
- `400` — campo desconocido (forbidNonWhitelisted)

### Taxes — `PATCH /tax-types/:taxTypeId/taxes/:id`

Actualización parcial.

**Errores:** `400` — validación fallida | `404` — no encontrado.

### Taxes — `DELETE /tax-types/:taxTypeId/taxes/:id`

**Response 204.** **Errores:** `404` — no encontrado.

---

### Product Taxes — `GET /products/:productId/taxes`

Lista paginada de impuestos asignados al producto.

**Query params** (opcionales): `page` (default: 1), `limit` (default: 20, máx: 100)

**Response 200:**
```json
{
  "data": [{ "id": 1, "productId": 1, "taxId": 1, "createdAt": "...", "updatedAt": "..." }],
  "total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNextPage": false
}
```

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

## Prorrateo en combos

Los combos **no tienen impuestos asignados directamente**. En su lugar, `CalculationService.sumTaxesWithProration()` calcula los impuestos del combo de la siguiente manera:

1. **Impuestos globales** — se aplican sobre el precio total del combo (`priceAfterMargin`).
2. **Impuestos específicos por producto** — se distribuye el precio del combo proporcionalmente entre los productos componentes según su precio de referencia (unitPrice × quantity). El impuesto específico de cada producto se aplica sobre su base prorrateada.

**Fórmula:**
```
precioRef_item = unitPrice_producto × cantidad
totalRef       = Σ precioRef_item

baseProrrateada_item = comboPrice × (precioRef_item / totalRef)
impuestoEspecífico   = baseProrrateada_item × tasa_item
```

**Prevención de doble conteo:** si un impuesto es global, **no** se aplica nuevamente en la etapa de específicos, aunque el producto lo tenga asignado en `product_taxes`. Se usa un `Set<number>` con los IDs globales para filtrar.

**Ejemplo:**
```
Combo $1.000 | Café $800 (×1) + Pan $400 (×1)
totalRef = 1.200

Café  → base prorrateada = 1.000 × (800/1200) = $666.67  | IIBB 3% → $20
Pan   → base prorrateada = 1.000 × (400/1200) = $333.33  | IIBB 5% → $16.67
IVA global 21% sobre $1.000 → $210

Total impuestos = $210 + $20 + $16.67 = $246.67
```

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| `code` único en `tax_types` | `create` y `update` cuando cambia el code |
| `value` entre 0.01 y 100 | DTO — `@Min(0.01)` + `@Max(100)` |
| `taxTypeId` debe existir al crear un tax (→ 404 si no existe) | `create` de taxes |
| Un impuesto global no puede asignarse a un producto (→ 400) | `create` de product-taxes |
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
└── product-taxes/
    ├── controllers/product-taxes.controller.ts
    ├── services/product-taxes.service.ts
    ├── entities/product-taxes.entity.ts
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
| Mensajes de error en español | ✅ |
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

**Total: 6 suites.**

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

**Total: 3 suites.**

> `product-taxes` incluye en el schema todas las entidades del árbol de dependencias de `ProductEntity` para satisfacer el validador de metadata de TypeORM: `ProductImageEntity`, `ComboItemEntity`, `ComboImageEntity`, `CategoryEntity`.

---

## Swagger

Disponible en `/api/docs` una vez corriendo la app.

| Módulo | Tag | Decoradores |
|---|---|---|
| Tax Types | `Tax Types` | `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` |
| Taxes | `Taxes` | ídem + `@ApiParam({ name: 'taxTypeId' })` |
| Product Taxes | `Product Taxes` | ídem + `@ApiParam({ name: 'productId' })` |

---

## Integración con otros módulos

```
TaxationModule
  ├── exporta TaxesService, TaxTypesService, ProductTaxesService
  └── consumido por pricing/calculation/
        └── CalculationService
              ├── taxRepo.find({ isGlobal: true })         → aplica a todos (productos y combos)
              ├── productTaxRepo.find({ productId })       → aplica al producto específico
              └── sumTaxesWithProration(comboId, price)    → combos: global + específicos vía prorrateo
```
