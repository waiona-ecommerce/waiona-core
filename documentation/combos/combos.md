# Combos — Análisis Técnico Completo

## ¿Qué es un combo?

Un combo es un paquete de múltiples productos vendidos juntos a un precio especial. Agrupa dos o más ítems del catálogo bajo un nombre, descripción y categoría propios. Al igual que los productos individuales, los combos tienen precio, descuentos, impuestos e imágenes asignados desde sus módulos correspondientes.

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Alta de nuevo paquete | Admin crea "Combo Familiar" con 2 Coca Cola + 1 agua |
| Actualización de descripción | Admin edita el nombre o descripción del combo |
| Reemplazo de ítems | Admin envía `items` en el PATCH y el sistema reemplaza la lista completa |
| Desactivación temporal | Admin pone `isActive: false` sin borrar el combo |
| Eliminación lógica | Admin elimina un combo descontinuado (soft delete) |
| Consulta desde el shop | Cliente ve combos activos con precio calculado |

## Tipos de datos

### Entidad principal

```typescript
class ComboEntity extends BaseEntity {
  id: number;               // PK autoincremental
  name: string;             // varchar(150)
  description: string;      // varchar(255)
  isActive: boolean;        // default: true
  categoryId: number;       // FK → categories.id (RESTRICT on delete)
  // relaciones
  category: CategoryEntity;
  items: ComboItemEntity[];
  images: ComboImageEntity[];
  // heredados de BaseEntity
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;   // soft delete via @DeleteDateColumn
}
```

### Entidad de ítem

```typescript
class ComboItemEntity extends BaseEntity {
  id: number;
  comboId: number;          // FK → combos.id (CASCADE on delete)
  productId: number;        // FK → products.id (RESTRICT on delete)
  quantity: number;         // int >= 1
  // relaciones
  combo: ComboEntity;
  product: ProductEntity;
  deletedAt: Date | null;   // soft delete
}
```

### Request: crear (CreateComboDto)

```typescript
{
  name: string;             // 2–150 chars, trimmed, requerido
  description: string;      // 5–255 chars, trimmed, requerido
  isActive?: boolean;       // opcional, default true
  categoryId: number;       // int >= 1, requerido — debe existir en DB
  items: [                  // mínimo 1 ítem
    {
      productId: number;    // int >= 1, debe existir en DB
      quantity: number;     // int >= 1
    }
  ];
}
```

### Request: actualizar (UpdateComboDto)

Todos los campos son opcionales. El DTO omite `items` de `CreateComboDto` y lo redefine con su propio tipo:

```typescript
{
  name?: string;
  description?: string;
  isActive?: boolean;
  categoryId?: number;
  items?: [               // si se envía, reemplaza la lista completa
    {
      productId: number;
      quantity: number;
    }
  ];
}
```

Cuando se envía `items`, el servicio hace soft delete de todos los ítems actuales y crea los nuevos dentro de la misma transacción.

### Response (ComboResponseDto)

```typescript
{
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  categoryId: number;
  categoryName: string;     // resuelto desde la relación category — '' si no se cargó
  items: [
    {
      productId: number;
      productName: string;  // resuelto desde items.product.name — '' si no se cargó
      quantity: number;
    }
  ];
  createdAt: Date;
  updatedAt: Date;
}
```

### Response: listado paginado

```typescript
{
  data: ComboResponseDto[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
```

## Endpoints

### GET /combos

Lista todos los combos no eliminados, paginados y ordenados por nombre A→Z. Incluye ítems y nombre de categoría.

**Request:**
```
GET /combos?page=1&limit=20
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Combo Familiar",
      "description": "2 Coca Cola + 1 Agua",
      "isActive": true,
      "categoryId": 3,
      "categoryName": "Combos",
      "items": [
        { "productId": 1, "productName": "Coca Cola 500ml", "quantity": 2 },
        { "productId": 4, "productName": "Agua Mineral 1L", "quantity": 1 }
      ],
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "hasNextPage": false
}
```

**Errores posibles:** ninguno (devuelve array vacío si no hay resultados).

---

### GET /combos/:id

Devuelve un combo por ID incluyendo ítems y nombre de categoría.

**Request:**
```
GET /combos/1
Authorization: Bearer <token>
```

**Response 200:** misma estructura que el objeto dentro de `data` en el listado.

| Error | Motivo |
|---|---|
| 404 | No existe combo con ese ID (o fue eliminado) |

---

### POST /combos

Crea un nuevo combo con sus ítems en una transacción atómica.

**Request:**
```json
{
  "name": "Combo Familiar",
  "description": "2 Coca Cola + 1 Agua Mineral",
  "categoryId": 3,
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 4, "quantity": 1 }
  ]
}
```

**Response 201:** combo completo (misma estructura que GET por ID).

| Error | Motivo |
|---|---|
| 400 | Datos inválidos (campos faltantes o fuera de rango) |
| 400 | `categoryId` no existe en la base de datos |
| 400 | Algún `productId` no existe en la base de datos |
| 400 | `productId` duplicado en la lista de ítems |

---

### PATCH /combos/:id

Actualización parcial. Solo se aplican los campos enviados. Si se envía `items`, reemplaza la lista completa.

**Request:**
```json
{
  "name": "Combo Familiar Plus",
  "items": [
    { "productId": 1, "quantity": 3 },
    { "productId": 4, "quantity": 1 }
  ]
}
```

**Response 200:** combo actualizado (misma estructura que GET por ID).

| Error | Motivo |
|---|---|
| 400 | Datos inválidos |
| 400 | `categoryId` enviado no existe |
| 400 | Algún `productId` de los ítems no existe |
| 400 | `productId` duplicado en la lista de ítems |
| 404 | Combo no encontrado |

---

### DELETE /combos/:id

Soft delete: el combo desaparece de todas las queries pero no se borra de la DB.

**Request:**
```
DELETE /combos/1
Authorization: Bearer <token>
```

**Response 204:** sin cuerpo.

| Error | Motivo |
|---|---|
| 404 | Combo no encontrado |

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| Un combo debe tener al menos 1 ítem | `@ArrayMinSize(1)` en el DTO + validación en servicio |
| No se puede repetir el mismo producto en un combo | `validateItems()` → `BadRequestException` si hay `productId` duplicado |
| Todos los productos del combo deben existir | `validateItems()` consulta todos con `In(ids)` y compara el count |
| La categoría debe existir antes de asignarla | `validateCategoryExists()` en create y update |
| No se puede borrar una categoría que tiene combos | `onDelete: 'RESTRICT'` en la FK de la entidad |
| El reemplazo de ítems es atómico | Create y update usan `dataSource.transaction()` — o todo o nada |
| Al reemplazar ítems, los anteriores se soft-deletean | `manager.softDelete(ComboItemEntity, { comboId })` dentro de la transacción |
| Los combos eliminados no aparecen en ninguna query | TypeORM filtra `WHERE deleted_at IS NULL` automáticamente |
| `isActive: false` no elimina el combo, solo lo oculta del shop | El campo existe independientemente del soft delete |

## Ejemplos de uso real

**Crear un combo:**
```json
POST /combos
{
  "name": "Combo Asado",
  "description": "Gaseosas y agua para el asado familiar",
  "categoryId": 5,
  "items": [
    { "productId": 1, "quantity": 4 },
    { "productId": 2, "quantity": 2 },
    { "productId": 4, "quantity": 2 }
  ]
}
```

**Desactivar un combo sin eliminarlo:**
```json
PATCH /combos/3
{
  "isActive": false
}
```

**Reemplazar todos los ítems del combo:**
```json
PATCH /combos/3
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 5, "quantity": 1 }
  ]
}
```

## Cumplimiento con agent skills

| Convención | Estado |
|---|---|
| Entidad extiende `BaseEntity` (`deletedAt`) | ✅ |
| Soft delete con `softDelete(id)` | ✅ |
| `PartialType` + `OmitType` desde `@nestjs/swagger` | ✅ |
| `@Patch` para actualización parcial | ✅ |
| `@HttpCode(HttpStatus.NO_CONTENT)` en DELETE | ✅ |
| FK con `@Column({ name: 'category_id' })` + `@JoinColumn` | ✅ |
| Respuesta mediante DTO (nunca entidad directa) | ✅ |
| `PaginatedResponseDto` con `findAndCount` | ✅ |
| Guards a nivel de clase (`ADMIN` + `SUPER_ADMIN`) | ✅ |
| Swagger: `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` | ✅ |
| Transacción atómica con `dataSource.transaction()` | ✅ |
| Unit tests (service + controller) | ✅ |
| E2E tests con PostgreSQL real | ✅ |

## Tests

### Unit tests

```bash
npx jest --testPathPattern="products/combos"
```

| Suite | Tests | Qué cubre |
|---|---|---|
| `ComboService` | 11 | findAll, findById, create (éxito + categoría inválida + producto inválido + producto duplicado), update (éxito + reemplazo de ítems + 404), delete (éxito + 404) |
| `ComboController` | 5 | Delegación al service para cada endpoint |

### E2E tests

```bash
npx jest --config test/jest-e2e.json --testPathPattern="combos.e2e"
```

| Caso | Status esperado |
|---|---|
| POST con datos válidos | 201 |
| POST con datos inválidos | 400 |
| POST con categoryId inexistente | 400 |
| POST con productId inexistente | 400 |
| POST con productId duplicado en items | 400 |
| GET listado paginado | 200 |
| GET por ID existente | 200 |
| GET por ID inexistente | 404 |
| PATCH actualiza campos básicos | 200 |
| PATCH reemplaza items | 200 |
| PATCH a ID inexistente | 404 |
| DELETE soft delete + luego 404 | 204 → 404 |
| DELETE a ID inexistente | 404 |

## Integración con otros módulos

```
CategoryEntity ──────────────────────────────────────┐
                                                      ↓
ProductEntity ──────────────────────────────── ComboEntity
                                                ↗         ↖
                              ComboItemEntity              ComboImageEntity
                              (productId + quantity)
                                    ↑
                              ProductEntity

combo-pricing/            → precio base + margen del combo
discount-combo-target/    → descuentos asignados al combo
combo-taxes/              → impuestos específicos del combo
calculation/              → motor de precio final
shop/                     → endpoint público para el cliente
orders/                   → combos dentro de pedidos
```
