# Margins — Análisis Técnico Completo

## ¿Qué es un margen?

Un margen representa la ganancia que el negocio agrega sobre el costo de un producto o combo. Se aplica **después del descuento y antes de los impuestos** dentro del motor de cálculo de precios.

```
unitPrice
  → aplicar descuento       → priceAfterDiscount
  → aplicar margen          → priceAfterMargin     ← acá actúa este módulo
  → aplicar impuestos       → finalPrice
  → aplicar cupón           → orderTotal
```

---

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Margen porcentual estándar | Productos de línea base: `20%` sobre el precio de costo |
| Margen fijo para productos importados | Bienes con costo fijo de importación: `+$500` por unidad |
| Margen diferenciado por categoría | Electrónica: `15%`, Alimentos: `8%` |
| Sin margen | Productos en liquidación: `0%` |

Un margen se **asigna a un `ProductPricing` o `ComboPricing`** — no se aplica directamente a un producto. Esto permite reutilizar el mismo margen en múltiples productos sin duplicar configuración.

---

## Tipos de datos

### Entidad (`MarginEntity`)

```typescript
{
  id:           number;       // PK autoincremental
  name:         string;       // nombre único, máx 100 chars
  value:        number;       // decimal(10,2) — viene como string de PG, convertido en DTO
  isPercentage: boolean;      // true = %, false = monto fijo
  deletedAt:    Date | null;  // soft delete vía @DeleteDateColumn
  createdAt:    Date;
  updatedAt:    Date;
}
```

### Request: crear margen (`CreateMarginDto`)

```typescript
{
  name:         string;   // requerido, 3–100 chars
  value:        number;   // requerido, >= 0, máx 2 decimales
  isPercentage: boolean;  // requerido
}
```

### Request: actualizar margen (`UpdateMarginDto`)

Todos los campos son opcionales (`PartialType` de `CreateMarginDto`):

```typescript
{
  name?:         string;
  value?:        number;
  isPercentage?: boolean;
}
```

### Response: margen (`MarginResponseDto`)

```typescript
{
  id:           number;
  name:         string;
  value:        number;   // ya convertido a number (PG devuelve decimal como string)
  isPercentage: boolean;
  createdAt:    Date;
  updatedAt:    Date;
}
```

### Response: listado paginado (`PaginatedResponseDto<MarginResponseDto>`)

```typescript
{
  data:        MarginResponseDto[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
  hasNextPage: boolean;
}
```

---

## Endpoints

Todos requieren JWT con rol `SUPER_ADMIN` o `ADMIN`.

### `POST /margins`

Crea un nuevo margen.

**Request:**
```json
{
  "name": "Margen estándar",
  "value": 20,
  "isPercentage": true
}
```

**Response 201:**
```json
{
  "id": 1,
  "name": "Margen estándar",
  "value": 20,
  "isPercentage": true,
  "createdAt": "2026-05-16T14:00:00.000Z",
  "updatedAt": "2026-05-16T14:00:00.000Z"
}
```

**Errores posibles:**
- `400` — porcentaje > 100 (`isPercentage: true` con `value: 150`)
- `409` — nombre ya existe

---

### `GET /margins?page=1&limit=20`

Lista paginada de márgenes activos (no eliminados).

**Query params** (opcionales):
```
page  → default: 1
limit → default: 20, máx: 100
```

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Margen estándar",
      "value": 20,
      "isPercentage": true,
      "createdAt": "2026-05-16T14:00:00.000Z",
      "updatedAt": "2026-05-16T14:00:00.000Z"
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

### `GET /margins/:id`

Obtiene un margen por ID.

**Response 200:** `MarginResponseDto`

**Errores posibles:**
- `404` — no encontrado

---

### `PATCH /margins/:id`

Actualización parcial. Solo se actualiza lo que se envía.

**Request:**
```json
{ "value": 25 }
```

**Response 200:** `MarginResponseDto` actualizado

**Errores posibles:**
- `400` — el nuevo valor excede 100 siendo porcentaje
- `404` — no encontrado
- `409` — el nuevo nombre ya existe en otro margen

---

### `DELETE /margins/:id`

Soft delete. **Bloqueado** si el margen está asignado a algún `ProductPricing` o `ComboPricing`.

**Response 204:** sin body

**Errores posibles:**
- `404` — no encontrado
- `409` — margen en uso por uno o más pricings

---

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| `name` único en toda la tabla | `create` y `update` cuando cambia el nombre |
| Si `isPercentage: true` → `value ≤ 100` | `create` y `update` |
| No eliminar si está en uso | `remove` — verifica `productPricing` y `comboPricing` en paralelo |
| Soft delete — `deletedAt` nunca `null` en registros eliminados | `remove` vía `softDelete()` |

---

## Ejemplos de uso real

**Margen porcentual para categoría general:**
```json
POST /margins
{ "name": "General 20%", "value": 20, "isPercentage": true }
```

**Margen fijo para productos importados:**
```json
POST /margins
{ "name": "Importado fijo", "value": 500, "isPercentage": false }
```

**Actualizar solo el valor:**
```json
PATCH /margins/1
{ "value": 22.5 }
```

**Intentar eliminar un margen en uso — responde 409:**
```json
DELETE /margins/1
→ 409 Conflict: "Margin is in use by one or more pricings and cannot be deleted"
```

---

## Cumplimiento con agent skills

| Check | Estado |
|---|---|
| Entidad extiende `BaseEntity` con `@DeleteDateColumn` | ✅ |
| Soft delete vía `repo.softDelete(id)` | ✅ |
| TypeORM filtra `deletedAt IS NULL` automáticamente | ✅ |
| Service retorna DTOs, nunca entidades | ✅ |
| `ParseIntPipe` en todos los params de ID | ✅ |
| Guards a nivel de clase | ✅ |
| `PartialType` de `@nestjs/swagger` en UpdateDto | ✅ |
| `Number(entity.value)` en ResponseDto — fix decimal de PG | ✅ |
| `@HttpCode(204)` en DELETE | ✅ |
| `GuardsModule` no importado en el módulo | ✅ |
| Unit tests — 3 repos mockeados, 22 tests | ✅ |
| Unit tests — happy path, 400, 404, 409 en service y controller | ✅ |
| E2E tests — PostgreSQL real, `dropSchema: true`, 17 tests | ✅ |
| Swagger — `@ApiTags`, `@ApiOperation`, `@ApiResponse` en controller | ✅ |
| Swagger — `@ApiProperty` en todos los DTOs | ✅ |

---

## Tests

### Unit tests (`src/modules/margins/`)

```bash
npx jest --testPathPattern="margins" --no-coverage
```

| Suite | Tests | Cobertura |
|---|---|---|
| `margins.service.spec.ts` | 13 | create, findAll, findOne, update, remove — happy path + 400/404/409 |
| `margins.controller.spec.ts` | 9 | delegación a service por cada endpoint |

### E2E tests (`test/margins/margins.e2e-spec.ts`)

```bash
# Requiere Docker con la DB de test corriendo (puerto 5433)
docker compose up -d
npx jest --config test/jest-e2e.json --testPathPattern="margins"
```

| Caso | Status code esperado |
|---|---|
| POST con datos válidos (porcentual) | 201 |
| POST con datos válidos (fijo) | 201 |
| POST sin campos requeridos | 400 |
| POST con porcentaje > 100 | 400 |
| POST con value negativo | 400 |
| POST con nombre duplicado | 409 |
| GET paginado | 200 |
| GET con `?page=1&limit=2` | 200 |
| GET por id existente | 200 |
| GET por id inexistente | 404 |
| PATCH actualiza valor | 200 |
| PATCH actualiza nombre | 200 |
| PATCH porcentaje > 100 | 400 |
| PATCH nombre duplicado | 409 |
| PATCH id inexistente | 404 |
| DELETE exitoso + GET posterior | 204 → 404 |
| DELETE id inexistente | 404 |

> El caso 409 "margen en uso por pricing" está cubierto en unit tests del service. En e2e requeriría crear `ProductEntity` + `ProductPricingEntity` con todas sus dependencias, lo que está fuera del scope del módulo aislado.

---

## Swagger

Disponible en `/api/docs` una vez que la app está corriendo.

Decoradores aplicados:
- Controller: `@ApiTags('Margins')`, `@ApiBearerAuth()`
- Cada endpoint: `@ApiOperation`, `@ApiResponse` (201/200/204/400/404/409), `@ApiParam`
- DTOs: `@ApiProperty` con ejemplos y descripciones en todos los campos

---

## Integración con otros módulos

```
MarginsModule
  └── exporta MarginsService
        └── consumido por pricing/
              ├── ProductPricingService  → asigna un MarginEntity al pricing de producto
              └── ComboPricingService    → asigna un MarginEntity al pricing de combo
```

El módulo registra `ProductPricingEntity` y `ComboPricingEntity` directamente en su `TypeOrmModule.forFeature` para poder verificar si un margen está en uso antes de eliminarlo, sin depender de importar el módulo de pricing completo.
