# Categories — Análisis Técnico Completo

## ¿Qué es una categoría?

Una categoría es el agrupador del catálogo de Waiona. Todo producto y combo debe pertenecer a una categoría. Las categorías soportan jerarquía padre/hijo (un nivel), lo que permite al admin organizar el catálogo en una estructura de árbol: una categoría raíz "Bebidas" puede tener hijos "Gaseosas", "Aguas" y "Jugos".

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Alta de nueva categoría raíz | Admin crea "Bebidas" sin parentId |
| Alta de subcategoría | Admin crea "Gaseosas" con `parentId` apuntando a "Bebidas" |
| Actualización de nombre | Admin cambia "Bebidas Frías" a "Bebidas" |
| Reasignación de padre | Admin mueve "Aguas" bajo "Hidratación" |
| Desactivación temporal | Admin pone `isActive: false` sin borrar la categoría |
| Eliminación lógica | Admin elimina una categoría vacía (sin productos ni combos) |
| Vista de árbol | Front obtiene `GET /categories/tree` para mostrar el menú de navegación |

## Tipos de datos

### Entidad

```typescript
class CategoryEntity extends BaseEntity {
  id: number;                     // PK autoincremental
  name: string;                   // varchar(100), único en todo el sistema
  description?: string;           // varchar(255), nullable
  isActive: boolean;              // default: true
  parentId?: number | null;       // FK → categories.id (SET NULL on delete)
  // relaciones
  parent?: CategoryEntity | null;
  children?: CategoryEntity[];
  // heredados de BaseEntity
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;         // soft delete via @DeleteDateColumn
}
```

La relación es auto-referencial: una categoría puede tener una categoría padre del mismo tipo. Si el padre se elimina, `parentId` de los hijos se pone en `NULL` (se convierten en raíz).

### Request: crear (CreateCategoryDto)

```typescript
{
  name: string;           // 2–100 chars, requerido, único
  description?: string;   // 5–255 chars, opcional
  isActive?: boolean;     // opcional, default true
  parentId?: number;      // int >= 1, opcional — debe existir en DB
}
```

### Request: actualizar (UpdateCategoryDto)

`PartialType(CreateCategoryDto)` — todos los campos son opcionales.

```typescript
{
  name?: string;
  description?: string;
  isActive?: boolean;
  parentId?: number;
}
```

### Response (CategoryResponseDto)

```typescript
{
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  parentId: number | null;   // null para categorías raíz
  createdAt: Date;
  updatedAt: Date;
}
```

### Response: árbol (CategoryTreeResponseDto)

```typescript
{
  id: number;
  name: string;
  children: CategoryTreeResponseDto[];   // recursivo, vacío si no tiene hijos
}
```

### Response: listado paginado

```typescript
{
  data: CategoryResponseDto[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
```

## Endpoints

### GET /categories

Lista todas las categorías no eliminadas, paginadas y ordenadas por nombre A→Z. Devuelve estructura plana (sin árbol).

**Request:**
```
GET /categories?page=1&limit=20
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Bebidas",
      "description": "Todo tipo de bebidas",
      "isActive": true,
      "parentId": null,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Gaseosas",
      "description": null,
      "isActive": true,
      "parentId": 1,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20,
  "hasNextPage": false
}
```

**Errores posibles:** ninguno (devuelve array vacío si no hay resultados).

---

### GET /categories/tree

Devuelve el árbol completo de categorías: solo las raíces (sin padre), cada una con sus hijos anidados. Se construye en memoria desde una sola query que trae todas las categorías.

**Request:**
```
GET /categories/tree
Authorization: Bearer <token>
```

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Bebidas",
    "children": [
      { "id": 2, "name": "Gaseosas", "children": [] },
      { "id": 3, "name": "Aguas", "children": [] }
    ]
  },
  {
    "id": 4,
    "name": "Snacks",
    "children": []
  }
]
```

**Errores posibles:** ninguno (devuelve array vacío si no hay categorías).

> **Nota técnica:** `GET /categories/tree` está declarado ANTES que `GET /categories/:id` en el controlador para que NestJS no lo interprete como un ID = `"tree"`.

---

### GET /categories/:id

Devuelve una categoría por ID (estructura plana, sin hijos).

**Request:**
```
GET /categories/1
Authorization: Bearer <token>
```

**Response 200:** objeto `CategoryResponseDto`.

| Error | Motivo |
|---|---|
| 404 | No existe categoría con ese ID (o fue eliminada) |

---

### POST /categories

Crea una nueva categoría. Si se envía `parentId`, valida que la categoría padre exista.

**Request:**
```json
{
  "name": "Gaseosas",
  "description": "Bebidas con gas",
  "parentId": 1
}
```

**Response 201:** `CategoryResponseDto` con los datos de la categoría creada.

| Error | Motivo |
|---|---|
| 400 | Datos inválidos (campos faltantes o fuera de rango) |
| 400 | `parentId` no existe en la base de datos |
| 409 | Ya existe una categoría con ese nombre |

---

### PATCH /categories/:id

Actualización parcial. Solo se aplican los campos enviados. Si se cambia el `parentId`, el sistema valida que no genere una jerarquía circular.

**Request:**
```json
{
  "name": "Bebidas Con Gas",
  "parentId": 5
}
```

**Response 200:** `CategoryResponseDto` actualizado.

| Error | Motivo |
|---|---|
| 400 | Datos inválidos |
| 400 | `parentId` enviado no existe |
| 400 | El nuevo `parentId` generaría un ciclo en la jerarquía |
| 404 | Categoría no encontrada |

---

### DELETE /categories/:id

Soft delete. Antes de eliminar, verifica que la categoría no tenga productos ni combos activos asignados.

**Request:**
```
DELETE /categories/1
Authorization: Bearer <token>
```

**Response 204:** sin cuerpo.

| Error | Motivo |
|---|---|
| 404 | Categoría no encontrada |
| 409 | La categoría tiene productos activos asignados |
| 409 | La categoría tiene combos activos asignados |

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| El nombre es único en todo el sistema | `unique: true` en la columna → 409 si ya existe |
| El padre debe existir antes de asignarlo | `validateParent()` en create y update |
| No se puede crear una jerarquía circular | `wouldCreateCycle()` en update → sube el árbol hasta la raíz |
| Si el padre se elimina, los hijos se convierten en raíz | `onDelete: 'SET NULL'` en la FK |
| No se puede eliminar una categoría con productos activos | `delete()` cuenta productos → `ConflictException` si > 0 |
| No se puede eliminar una categoría con combos activos | `delete()` cuenta combos → `ConflictException` si > 0 |
| Los deletedAt no aparecen en ninguna query | TypeORM filtra `WHERE deleted_at IS NULL` automáticamente |
| `isActive: false` no elimina la categoría | El campo existe independientemente del soft delete |

### Detección de ciclos

Al mover una categoría a un nuevo padre, `wouldCreateCycle()` recorre la cadena de padres del candidato hasta la raíz:

```
¿El candidato a nuevo padre es descendiente de la categoría que se mueve?
  → Si en algún punto de la cadena padre→abuelo→bisabuelo aparece el id de la categoría: ciclo detectado
```

Ejemplo: no se puede poner "Bebidas" como hijo de "Gaseosas" si "Gaseosas" ya es hija de "Bebidas".

## Ejemplos de uso real

**Crear una categoría raíz:**
```json
POST /categories
{
  "name": "Bebidas",
  "description": "Todo tipo de bebidas"
}
```

**Crear una subcategoría:**
```json
POST /categories
{
  "name": "Gaseosas",
  "parentId": 1
}
```

**Mover una categoría a otro padre:**
```json
PATCH /categories/2
{
  "parentId": 7
}
```

**Desactivar una categoría:**
```json
PATCH /categories/2
{
  "isActive": false
}
```

## Cumplimiento con agent skills

| Convención | Estado |
|---|---|
| Entidad extiende `BaseEntity` (`deletedAt`) | ✅ |
| Soft delete con `softDelete(id)` | ✅ |
| `PartialType` para update DTO | ✅ |
| `@Patch` para actualización parcial | ✅ |
| `@HttpCode(HttpStatus.NO_CONTENT)` en DELETE | ✅ |
| FK con `@Column({ name: 'parent_id' })` + `@JoinColumn` | ✅ |
| Respuesta mediante DTO (nunca entidad directa) | ✅ |
| `PaginatedResponseDto` con `findAndCount` | ✅ |
| Guards a nivel de clase (`ADMIN` + `SUPER_ADMIN`) | ✅ |
| Ruta específica `/tree` declarada antes que `/:id` | ✅ |
| Swagger: `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` | ✅ |
| Unit tests (service + controller) | ✅ |
| E2E tests con PostgreSQL real | ✅ |

## Tests

### Unit tests

```bash
npx jest --testPathPattern="products/categories"
```

| Suite | Tests | Qué cubre |
|---|---|---|
| `CategoryService` | 12 | findAll, findById, getTree, create (éxito + padre inválido), update (éxito + padre inválido + ciclo detectado + 404), delete (éxito + tiene productos + tiene combos + 404) |
| `CategoryController` | 6 | Delegación al service para cada endpoint |

### E2E tests

```bash
npx jest --config test/jest-e2e.json --testPathPattern="categories.e2e"
```

| Caso | Status esperado |
|---|---|
| POST con datos válidos (raíz) | 201 |
| POST con parentId válido (subcategoría) | 201 |
| POST con datos inválidos | 400 |
| POST con parentId inexistente | 400 |
| GET listado paginado | 200 |
| GET árbol de categorías | 200 |
| GET por ID existente | 200 |
| GET por ID inexistente | 404 |
| PATCH actualiza campos | 200 |
| PATCH con ciclo detectado | 400 |
| PATCH a ID inexistente | 404 |
| DELETE categoría vacía | 204 |
| DELETE con productos activos | 409 |
| DELETE con combos activos | 409 |
| DELETE a ID inexistente | 404 |

## Integración con otros módulos

```
CategoryEntity (auto-referencial)
    ↑ parent / children ↓
    CategoryEntity (subcategorías)
           ↓
    ┌──────┴──────┐
    ↓             ↓
ProductEntity  ComboEntity
    ↓             ↓
  pricing      pricing
  stock        discounts
  discounts    taxes
  taxes        images
  images       shop
  shop
```

Las categorías son el punto de partida del árbol de navegación del shop. El front usa `GET /categories/tree` para construir el menú de categorías y filtrar productos/combos por sección.
