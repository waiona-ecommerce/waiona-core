# Products — Análisis Técnico Completo

## ¿Qué es un producto?

Un producto es la unidad base del catálogo de Waiona. Representa un artículo físico que puede venderse individualmente o como parte de un combo. Cada producto pertenece a una categoría, tiene un SKU único, una unidad de medida, e imágenes asociadas. El módulo de pricing, stock, descuentos e impuestos referencia directamente al producto para calcular el precio final que ve el cliente en el shop.

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Alta de nuevo ítem al catálogo | Admin crea "Coca Cola 500ml" con SKU `COCA-500` |
| Actualización de descripción o nombre | Admin edita el nombre tras rebranding |
| Desactivación temporal | Admin pone `isActive: false` sin borrar el producto |
| Eliminación lógica del catálogo | Admin elimina un producto descontinuado (soft delete) |
| Consulta desde el shop | Cliente busca productos activos con precio calculado |

## Tipos de datos

### Entidad

```typescript
class ProductEntity extends BaseEntity {
  id: number;               // PK autoincremental
  sku: string;              // varchar(50), único, convertido a mayúsculas al guardar
  name: string;             // varchar(150)
  description: string;      // varchar(255)
  isActive: boolean;        // default: true
  categoryId: number;       // FK → categories.id (RESTRICT on delete)
  measurementUnit: ProductMeasurementUnit; // enum: 'unit' | 'kg' | 'lt' | 'gr' | 'ml'
  measurementValue?: number; // decimal(10,2), nullable — ej: 500 para "500ml"
  // relaciones (cargadas con join cuando se necesitan)
  category: CategoryEntity;
  images: ProductImageEntity[];
  comboItems: ComboItemEntity[];
  // heredados de BaseEntity
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;   // soft delete via @DeleteDateColumn
}
```

### Request: crear (CreateProductDto)

```typescript
{
  sku: string;              // 3–50 chars, requerido
  name: string;             // 2–150 chars, requerido
  description: string;      // 5–255 chars, requerido
  isActive?: boolean;       // opcional, default true
  categoryId: number;       // int >= 1, requerido — debe existir en DB
  measurementUnit: 'unit' | 'kg' | 'lt' | 'gr' | 'ml'; // requerido
  measurementValue?: number; // >= 0, opcional
}
```

### Request: actualizar (UpdateProductDto)

Todos los campos son opcionales (`PartialType(CreateProductDto)`). Solo se envían los campos a modificar.

```typescript
{
  sku?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  categoryId?: number;
  measurementUnit?: 'unit' | 'kg' | 'lt' | 'gr' | 'ml';
  measurementValue?: number;
}
```

### Response (ProductResponseDto)

```typescript
{
  id: number;
  sku: string;              // uppercase
  name: string;
  description: string;
  isActive: boolean;
  categoryId: number;
  categoryName: string;     // resuelto desde la relación category — '' si no se cargó
  measurementUnit: string;
  measurementValue?: number; // decimal(10,2) de PG convertido a number en el DTO
  createdAt: Date;
  updatedAt: Date;
}
```

### Response: listado paginado

```typescript
{
  data: ProductResponseDto[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
```

## Endpoints

### GET /products

Lista todos los productos no eliminados, paginados y ordenados por nombre A→Z.

**Request:**
```
GET /products?page=1&limit=20
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "sku": "COCA-500",
      "name": "Coca Cola 500ml",
      "description": "Gaseosa negra 500ml",
      "isActive": true,
      "categoryId": 3,
      "categoryName": "Bebidas",
      "measurementUnit": "unit",
      "measurementValue": null,
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

### GET /products/:id

Devuelve un producto por ID incluyendo el nombre de su categoría.

**Request:**
```
GET /products/1
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "id": 1,
  "sku": "COCA-500",
  "name": "Coca Cola 500ml",
  "description": "Gaseosa negra 500ml",
  "isActive": true,
  "categoryId": 3,
  "categoryName": "Bebidas",
  "measurementUnit": "unit",
  "measurementValue": null,
  "createdAt": "2026-05-01T00:00:00.000Z",
  "updatedAt": "2026-05-01T00:00:00.000Z"
}
```

| Error | Motivo |
|---|---|
| 404 | No existe producto con ese ID (o fue eliminado) |

---

### POST /products

Crea un nuevo producto. El SKU se guarda en mayúsculas automáticamente.

**Request:**
```json
{
  "sku": "coca-500",
  "name": "Coca Cola 500ml",
  "description": "Gaseosa negra 500ml",
  "categoryId": 3,
  "measurementUnit": "unit"
}
```

**Response 201:**
```json
{
  "id": 5,
  "sku": "COCA-500",
  "name": "Coca Cola 500ml",
  "description": "Gaseosa negra 500ml",
  "isActive": true,
  "categoryId": 3,
  "categoryName": "Bebidas",
  "measurementUnit": "unit",
  "measurementValue": null,
  "createdAt": "2026-05-17T00:00:00.000Z",
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

| Error | Motivo |
|---|---|
| 400 | Datos inválidos (campos faltantes, SKU muy corto, enum inválido) |
| 400 | `categoryId` no existe en la base de datos |
| 409 | Ya existe un producto con ese SKU |

---

### PATCH /products/:id

Actualización parcial. Solo se aplican los campos enviados.

**Request:**
```json
{
  "name": "Coca Cola 1L",
  "isActive": false
}
```

**Response 200:** producto actualizado (misma estructura que GET).

| Error | Motivo |
|---|---|
| 400 | Datos inválidos |
| 400 | `categoryId` enviado no existe |
| 400 | `sku` enviado ya pertenece a otro producto |
| 404 | Producto no encontrado |

---

### DELETE /products/:id

Soft delete: el producto desaparece de todas las queries pero no se borra de la DB.

**Request:**
```
DELETE /products/1
Authorization: Bearer <token>
```

**Response 204:** sin cuerpo.

| Error | Motivo |
|---|---|
| 404 | Producto no encontrado |

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| SKU único en todo el sistema | `create()` → `ConflictException` si ya existe |
| SKU se guarda en mayúsculas | `create()` y `update()` hacen `.toUpperCase()` antes de guardar |
| La categoría debe existir antes de asignarla | `validateCategoryExists()` en create y update |
| No se puede borrar una categoría que tiene productos | `onDelete: 'RESTRICT'` en la FK de la entidad |
| Los productos eliminados no aparecen en ninguna query | TypeORM filtra `WHERE deleted_at IS NULL` automáticamente |
| `isActive: false` no elimina el producto, solo lo oculta del shop | El campo existe independientemente del soft delete |

## Ejemplos de uso real

**Crear un producto con unidad de medida:**
```json
POST /products
{
  "sku": "SPRITE-500",
  "name": "Sprite 500ml",
  "description": "Gaseosa verde lima limón",
  "categoryId": 3,
  "measurementUnit": "ml",
  "measurementValue": 500
}
```

**Desactivar un producto sin eliminarlo:**
```json
PATCH /products/5
{
  "isActive": false
}
```

**Cambiar de categoría:**
```json
PATCH /products/5
{
  "categoryId": 7
}
```

## Cumplimiento con agent skills

| Convención | Estado |
|---|---|
| Entidad extiende `BaseEntity` (`deletedAt`) | ✅ |
| Soft delete con `softDelete(id)` | ✅ |
| `PartialType` desde `@nestjs/swagger` | ✅ |
| `@Patch` para actualización parcial | ✅ |
| `@HttpCode(HttpStatus.NO_CONTENT)` en DELETE | ✅ |
| FK con `@Column({ name: 'category_id' })` + `@JoinColumn` | ✅ |
| Respuesta mediante DTO (nunca entidad directa) | ✅ |
| `PaginatedResponseDto` con `findAndCount` | ✅ |
| Guards a nivel de clase (`ADMIN` + `SUPER_ADMIN`) | ✅ |
| Swagger: `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` | ✅ |
| Unit tests (service + controller) | ✅ |
| E2E tests con PostgreSQL real | ✅ |

## Tests

### Unit tests

```bash
npx jest --testPathPattern="products/product"
```

| Suite | Tests | Qué cubre |
|---|---|---|
| `ProductService` | 11 | findAll, findById, create (éxito + SKU duplicado + categoría inválida), update (éxito + SKU duplicado + 404), delete (éxito + 404) |
| `ProductController` | 5 | Delegación al service para cada endpoint |

### E2E tests

```bash
npx jest --config test/jest-e2e.json --testPathPattern="product.e2e"
```

| Caso | Status esperado |
|---|---|
| POST con datos válidos | 201 |
| POST con SKU duplicado | 409 |
| POST con datos inválidos | 400 |
| POST con categoryId inexistente | 400 |
| GET listado paginado | 200 |
| GET por ID existente | 200 |
| GET por ID inexistente | 404 |
| PATCH actualiza campos | 200 |
| PATCH a ID inexistente | 404 |
| DELETE soft delete + luego 404 | 204 → 404 |
| DELETE a ID inexistente | 404 |

## Integración con otros módulos

```
CategoryEntity ──────────────────────────────────────────────────┐
                                                                  ↓
                                                          ProductEntity
                                                         ↗     ↑      ↖
                              ProductImageEntity ────────       |       ComboItemEntity
                                                               |
                         ┌─────────────────────────────────────┤
                         ↓                                      ↓
              product-pricing/                           discount-product-target/
              (precio base + margen)               (descuentos asignados al producto)
                         ↓
              calculation/
              (motor de precio final)
                         ↓
              shop/                                    orders/
              (endpoint público)                 (creación de pedidos)
```
