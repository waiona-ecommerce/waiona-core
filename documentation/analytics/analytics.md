# Analytics — Análisis Técnico

## ¿Qué es el módulo analytics?

Módulo de solo lectura que expone métricas agregadas para el panel de administración. No persiste datos propios — todo es calculado en tiempo real con QueryBuilder sobre las tablas de `orders`, `order_items` y `stock_items`.

```
GET /v1/analytics/orders           → resumen de órdenes por estado + revenue
GET /v1/analytics/products/top     → top 10 productos por unidades vendidas
GET /v1/analytics/stock/critical   → stock items por debajo del umbral crítico
```

Todos los endpoints requieren `ADMIN` o `SUPER_ADMIN`.

---

## Archivos

```
src/modules/analytics/
├── analytics.module.ts
├── analytics.controller.ts
├── analytics.service.ts
└── analytics.service.spec.ts

test/analytics/
└── analytics.e2e-spec.ts
```

---

## Endpoints

### `GET /v1/analytics/orders`

Agrega conteos por estado y totales de revenue (excluyendo órdenes canceladas del revenue).

**Response:**
```typescript
{
  total:           number;   // total de órdenes (todos los estados)
  byStatus: {
    pending:       number;
    confirmed:     number;
    dispatched:    number;
    delivered:     number;
    cancelled:     number;
  };
  totalRevenue:    number;   // SUM(total) de órdenes no canceladas
  revenueToday:    number;   // ídem, solo las de hoy (createdAt >= CURRENT_DATE)
  revenueThisMonth:number;   // ídem, solo las del mes actual
}
```

**Queries:**
1. `GROUP BY status` con `COUNT(*)` para el byStatus
2. 3 queries paralelas con `SUM(o.total)` con filtros de fecha usando `clone()` sobre un QueryBuilder base

---

### `GET /v1/analytics/products/top`

Top 10 productos por suma de `quantity` en `order_items` de órdenes con `status = DELIVERED`. Solo incluye items con `productId IS NOT NULL` (excluye combos).

**Response:**
```typescript
Array<{
  productId: number;
  name:      string;
  sku:       string;
  totalSold: number;
}>
```

---

### `GET /v1/analytics/stock/critical`

Stock items donde `quantity_current <= stock_critical`, con JOIN a `products` y `stock_locations`. Devuelve también `quantityAvailable` calculado en memoria (`current - reserved`). Ordenado por `quantityCurrent ASC` (los más críticos primero).

**Response:**
```typescript
Array<{
  id:               number;
  productId:        number;
  productName:      string;
  sku:              string;
  locationId:       number;
  locationName:     string;
  quantityCurrent:  number;
  quantityReserved: number;
  quantityAvailable:number;   // calculado: current - reserved
  stockCritical:    number;
  stockMin:         number;
}>
```

---

## Consideraciones

- **Sin caché:** Las queries corren en tiempo real. Con pocos datos es suficiente. Si el volumen crece, agregar cache sobre `GET /analytics/*` con TTL corto (5min).
- **Sin paginación:** `products/top` está hardcodeado a LIMIT 10. `stock/critical` devuelve todos. Ambos deberían ser acotados en un escenario con miles de productos.
- **Soft delete respetado:** Todas las queries filtran `isDeleted = false`.
- **Revenue excluye CANCELLED:** Por diseño — una orden cancelada no genera ingreso real.
