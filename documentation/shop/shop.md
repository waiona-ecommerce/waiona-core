# Shop — Análisis Técnico Completo

## ¿Qué es el shop?

El shop es la vista pública del catálogo de Waiona. Expone productos y combos activos con su precio calculado (aplicando descuentos, márgenes e impuestos) y el estado de stock real. A diferencia de los módulos de gestión (products, combos, categories), el shop no requiere autenticación: cualquier cliente puede consultar el catálogo. Es el puente entre el backoffice de administración y la experiencia de compra del cliente.

## Cuándo se usa en el negocio

| Escenario | Ejemplo |
|---|---|
| Cliente navega el catálogo | GET /v1/shop/items devuelve productos y combos activos con precio final |
| Cliente busca por nombre | GET /v1/shop/items?search=coca devuelve ítems cuyo nombre contiene "coca" |
| Cliente filtra por categoría | GET /v1/shop/items?categoryId=3 filtra por sección del catálogo |
| Cliente filtra por rango de precio | GET /v1/shop/items?minPrice=100&maxPrice=500 |
| Cliente ve solo productos o solo combos | GET /v1/shop/items?type=product o type=combo |
| Cliente abre el detalle de un ítem | GET /v1/shop/items/1?type=product devuelve precio desglosado, stock e imágenes |

## Tipos de datos

### Request: búsqueda (SearchShopDto)

Todos los parámetros son opcionales y se pasan como query params.

```typescript
{
  search?: string;      // 1–100 chars — búsqueda por nombre (ILike)
  categoryId?: number;  // int >= 1 — filtra por categoría
  type?: 'product' | 'combo'; // filtra solo un tipo
  minPrice?: number;    // decimal >= 0 — precio final mínimo
  maxPrice?: number;    // decimal >= 0 — precio final máximo
  page?: number;        // int >= 1, default 1
  limit?: number;       // int 1–100, default 20
}
```

> **Nota:** el filtro de precio requiere calcular el precio de cada ítem antes de paginar. Por rendimiento, cuando hay filtro de precio el servicio escanea como máximo 500 candidatos (`PRICE_FILTER_SCAN_LIMIT`).

### Response: listado (ShopItemResponseDto)

```typescript
{
  id: number;
  name: string;
  type: 'product' | 'combo';
  originalPrice: number;      // precio sin descuento (margen + impuestos sobre unitPrice)
  finalPrice: number;         // precio real que paga el cliente
  discountAmount: number;     // monto del descuento aplicado
  hasDiscount: boolean;
  inStock: boolean;
  quantityAvailable: number;
  image?: string;             // URL de la primera imagen (menor posición), undefined si no tiene
  category?: string;          // nombre de la categoría del ítem
}
```

### Response: listado paginado (ShopPaginatedResponseDto)

```typescript
{
  data: ShopItemResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}
```

### Response: detalle (ShopDetailResponseDto)

```typescript
{
  id: number;
  name: string;
  description: string;
  type: 'product' | 'combo';
  originalPrice: number;           // precio sin descuento
  finalPrice: number;              // precio real
  discountAmount: number;
  priceAfterDiscount: number;      // precio después de descuento, antes de impuestos
  taxes: number;                   // monto total de impuestos aplicados
  hasDiscount: boolean;
  inStock: boolean;
  quantityAvailable: number;
  stockStatus: 'available' | 'low' | 'critical' | 'out_of_stock';
  category?: string;               // nombre de la categoría del ítem
  images: string[];                // URLs ordenadas por position ASC
  items?: ComboItemShopDto[];      // solo para type=combo
}

// Solo para combos:
class ComboItemShopDto {
  productId: number;
  productName: string;
  quantity: number;
}
```

### Lógica de stockStatus (solo productos individuales)

| Estado | Condición |
|---|---|
| `out_of_stock` | Sin stock o `quantityAvailable <= 0` |
| `critical` | `quantityAvailable <= stockCritical` |
| `low` | `quantityAvailable <= stockMin` |
| `available` | Por encima del umbral mínimo |

Para combos, el stock se calcula sumando el stock de cada producto componente ponderado por su `quantity`; el resultado es `{ inStock, quantityAvailable }` y el stockStatus siempre es `available` o `out_of_stock`.

## Endpoints

### GET /v1/shop/items

Devuelve productos y combos activos paginados con precio calculado y stock. No requiere autenticación.

**Request:**
```
GET /v1/shop/items?page=1&limit=20
GET /v1/shop/items?search=coca&type=product
GET /v1/shop/items?categoryId=3&minPrice=100&maxPrice=500
```

**Response 200:**
```json
{
  "total": 2,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "hasNextPage": false,
  "data": [
    {
      "id": 1,
      "name": "Coca Cola 500ml",
      "type": "product",
      "originalPrice": 850.00,
      "finalPrice": 720.00,
      "discountAmount": 130.00,
      "hasDiscount": true,
      "inStock": true,
      "quantityAvailable": 48,
      "image": "https://cdn.example.com/coca.jpg",
      "category": "Bebidas"
    },
    {
      "id": 2,
      "name": "Combo Familiar",
      "type": "combo",
      "originalPrice": 2100.00,
      "finalPrice": 1890.00,
      "discountAmount": 210.00,
      "hasDiscount": true,
      "inStock": true,
      "quantityAvailable": 12,
      "image": "https://cdn.example.com/combo.jpg",
      "category": "Combos"
    }
  ]
}
```

| Error | Motivo |
|---|---|
| 400 | `minPrice` mayor que `maxPrice` |

> **Ítems sin precio configurado:** los productos o combos activos que no tienen precio configurado en el módulo de pricing no aparecen en el listado — el servicio los filtra silenciosamente (`safeCalculate` devuelve `null`).

---

### GET /v1/shop/items/:id

Devuelve el detalle completo de un producto o combo: precio desglosado, stock, imágenes y (si es combo) lista de productos que lo componen. No requiere autenticación.

El parámetro `type` es obligatorio para que el sistema sepa si buscar en `products` o en `combos`.

**Request:**
```
GET /v1/shop/items/1?type=product
GET /v1/shop/items/2?type=combo
```

**Response 200 (producto):**
```json
{
  "id": 1,
  "name": "Coca Cola 500ml",
  "description": "Gaseosa negra 500ml",
  "type": "product",
  "originalPrice": 850.00,
  "finalPrice": 720.00,
  "discountAmount": 130.00,
  "priceAfterDiscount": 650.00,
  "taxes": 70.00,
  "hasDiscount": true,
  "inStock": true,
  "quantityAvailable": 48,
  "stockStatus": "available",
  "category": "Bebidas",
  "images": [
    "https://cdn.example.com/coca-1.jpg",
    "https://cdn.example.com/coca-2.jpg"
  ]
}
```

**Response 200 (combo):**
```json
{
  "id": 2,
  "name": "Combo Familiar",
  "description": "2 Coca Cola + 1 Agua Mineral",
  "type": "combo",
  "originalPrice": 2100.00,
  "finalPrice": 1890.00,
  "discountAmount": 210.00,
  "priceAfterDiscount": 1750.00,
  "taxes": 140.00,
  "hasDiscount": true,
  "inStock": true,
  "quantityAvailable": 12,
  "stockStatus": "available",
  "category": "Combos",
  "images": ["https://cdn.example.com/combo.jpg"],
  "items": [
    { "productId": 1, "productName": "Coca Cola 500ml", "quantity": 2 },
    { "productId": 4, "productName": "Agua Mineral 1L", "quantity": 1 }
  ]
}
```

| Error | Motivo |
|---|---|
| 400 | Parámetro `type` no enviado o valor inválido |
| 404 | Ítem no encontrado, inactivo, o sin precio configurado |

## Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| Solo aparecen ítems con `isActive: true` | Filtro `where: { isActive: true }` en ambas queries |
| Los ítems sin precio no aparecen | `safeCalculate*` devuelve `null` → se filtran del resultado |
| El precio mostrado incluye descuento, margen e impuestos | `CalculationService.calculateProduct / calculateCombo` |
| La imagen del listado es la de menor posición | `images.sort((a,b) => a.position - b.position)[0]` |
| El detalle muestra todas las imágenes ordenadas | `images.sort(...)` devuelve array completo |
| El filtro de precio opera sobre `finalPrice` | Comparación post-cálculo |
| Con filtro de precio se escanean máximo 500 ítems | `PRICE_FILTER_SCAN_LIMIT = 500` — protección de rendimiento |
| No requiere autenticación | `@Controller('shop')` sin `@UseGuards` |
| `minPrice` no puede superar `maxPrice` | Validación explícita → `BadRequestException` |

## Flujo de cálculo de precio

```
unitPrice (precio base en pricing)
    ↓ aplicar descuento (discount-product-target / discount-combo-target)
priceAfterDiscount
    ↓ aplicar margen (margins)
    ↓ aplicar impuestos (product-taxes — combos usan prorrateo lineal, sin combo-taxes)
finalPrice  ←── lo que ve el cliente en el shop

fullPrice = precio sin descuento (margen + impuestos sobre unitPrice) → se muestra tachado si hasDiscount
```

## Cumplimiento con agent skills

| Convención | Estado |
|---|---|
| Endpoint público sin guards | ✅ |
| Respuesta mediante DTO (nunca entidad directa) | ✅ |
| Validación con class-validator + `@Type(() => Number)` en query params | ✅ |
| Swagger: `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiQuery` | ✅ |
| Separación de lógica en métodos privados por tipo | ✅ |
| Safe wrappers para cálculo y stock (nunca rompe el listado) | ✅ |
| Unit tests (service + controller) | ✅ |
| E2E tests con PostgreSQL real | ✅ |

## Tests

### Unit tests

```bash
npx jest --testPathPattern="products/shop"
```

| Suite | Tests | Qué cubre |
|---|---|---|
| `ShopService` | ~10 | search (sin filtros, con search, con type, con categoryId, con filtro de precio), findById (producto, combo, sin tipo, ítem inactivo, sin precio) |
| `ShopController` | 2 | Delegación a `search` y `findById` |

### E2E tests

```bash
npx jest --config test/jest-e2e.json --testPathPattern="shop.e2e"
```

| Caso | Status esperado |
|---|---|
| GET /v1/shop/items sin filtros | 200 |
| GET /v1/shop/items?search=nombre | 200 |
| GET /v1/shop/items?type=product | 200 |
| GET /v1/shop/items?type=combo | 200 |
| GET /v1/shop/items?categoryId=N | 200 |
| GET /v1/shop/items?minPrice=X&maxPrice=Y | 200 |
| GET /v1/shop/items?minPrice mayor que maxPrice | 400 |
| GET /v1/shop/items/:id?type=product (existe y tiene precio) | 200 |
| GET /v1/shop/items/:id?type=combo (existe y tiene precio) | 200 |
| GET /v1/shop/items/:id sin type | 400 |
| GET /v1/shop/items/:id de ítem inexistente | 404 |
| GET /v1/shop/items/:id de ítem inactivo | 404 |

## Cache

Solo `GET /v1/shop/categories` está cacheado, usando el `CacheInterceptor` oficial de NestJS con Redis (configurado globalmente en `app.module.ts`).

```ts
@Get('categories')
@UseInterceptors(CacheInterceptor)
@CacheKey('shop:categories')
@CacheTTL(300_000) // 5 minutos
async getCategories(): Promise<CategoryTreeResponseDto[]> { ... }
```

- Las siguientes requests en los 5 minutos posteriores devuelven el valor de Redis sin tocar la DB.
- Expiración por TTL — no hay invalidación manual. Si un admin modifica categorías, el cambio aparece en el próximo ciclo (máx 5 min).

`GET /v1/shop/items` y `GET /v1/shop/items/:id` **no tienen cache** — precio y stock son datos en vivo con consecuencias económicas.

## Integración con otros módulos

```
ProductEntity ──────┐
                    ↓
ComboEntity ────────→  ShopService
                         ↓           ↓           ↓
                   CalculationService  StockItemsService  images
                         ↓
               product-pricing / combo-pricing
               margins / product-taxes (prorrateo en combos)
               discount-product-target / discount-combo-target
                         ↓
                   ShopPaginatedResponseDto / ShopDetailResponseDto
                         ↓
                      orders/
               (el cliente agrega ítems del shop a un pedido)
```
