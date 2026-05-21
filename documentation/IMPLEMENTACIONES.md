# Implementaciones Pendientes — Post Blocks 1-9

Bloques 1-9 completados. Este documento cubre las implementaciones pendientes para la versión de producción.
Ordenadas por prioridad de cara al desarrollo del frontend.

---

## ✅ Bloque 7 — Cuenta y sesión _(completado)_

### 1. Cambio de password autenticado

**Endpoint:** `PATCH /v1/auth/change-password` — requiere JWT. Body: `{ currentPassword, newPassword }`. Valida con `bcrypt.compare()`, hashea y guarda.

### 2. Cerrar sesión en todos los dispositivos

**Endpoint:** `POST /v1/auth/logout-all` — revoca todos los `RefreshTokenEntity` del usuario con `revokedAt IS NULL`.

---

## ✅ Bloque 8 — Imágenes (upload real) _(completado)_

### 3. Upload de imágenes con Cloudinary

**Archivos:** `src/modules/storage/storage.service.ts`, `src/modules/storage/storage.module.ts`

- `POST /v1/product-images` y `POST /v1/combo-images` aceptan `multipart/form-data`
- `StorageService.upload()` sube a Cloudinary y devuelve `{ url, publicId }`
- `DELETE` borra el archivo de Cloudinary antes del soft delete via `StorageService.delete(publicId)`

**Variables de entorno:**
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## ✅ Bloque 9 — Dashboard admin _(completado)_

### 4. Endpoints de estadísticas

**Archivos:** `src/modules/analytics/analytics.controller.ts`, `src/modules/analytics/analytics.service.ts`

- `GET /v1/analytics/orders` — resumen de órdenes por estado + revenue (total, hoy, este mes)
- `GET /v1/analytics/products/top` — top 10 productos por unidades vendidas en órdenes DELIVERED
- `GET /v1/analytics/stock/critical` — stock items con `quantityCurrent <= stockCritical`
- Requieren `ADMIN` o `SUPER_ADMIN`. QueryBuilder con agregaciones — sin carga de entidades en memoria.

---

## Bloque 10 — Escala

Solo implementar cuando haya datos reales y se note el problema. No optimizar prematuramente.

### 5. Cursor pagination en orders

**El problema:** `OFFSET 10000` obliga a PostgreSQL a leer y descartar 10.000 filas. A escala, destruye la performance.

**Archivos:** `src/modules/orders/services/orders.service.ts`, `src/modules/orders/dto/`

- Reemplazar offset pagination por cursor en `GET /v1/orders`
- Cursor = último `id` de la página anterior
- Query: `WHERE id > :cursor ORDER BY id ASC LIMIT :limit`
- Response: `{ data: [...], nextCursor: number | null, hasMore: boolean }`
- Mantener compatibilidad: si no viene `cursor`, empieza desde el primero

**Criterio para implementar:** cuando `orders` supere los 10.000 registros o se note lentitud en el listado admin.

**Esfuerzo:** 3hs

---

### 6. Notificaciones en tiempo real (SSE)

**El problema:** el cliente hace polling para ver si su orden cambió de estado. Ineficiente y lento.

**Solución:** Server-Sent Events — más simple que WebSockets, suficiente para updates unidireccionales.

**Archivos nuevos:** `src/modules/orders/controllers/orders-sse.controller.ts`

- `GET /v1/orders/:id/events` — stream SSE que emite cuando cambia el status de esa orden
- El `OrdersService.updateStatus()` emite un evento al stream si hay listeners activos
- Sin dependencias nuevas — NestJS soporta SSE nativamente con `@Sse()` y `Observable`

**Criterio para implementar:** cuando el frontend necesite updates en tiempo real en la pantalla de seguimiento de pedido.

**Esfuerzo:** 4hs

---

## Resumen

| # | Feature | Bloque | Estado | Prioridad | Esfuerzo |
|---|---|---|---|---|---|
| 1 | Cambio de password autenticado | 7 | ✅ Done | 🔴 Alta | 2hs |
| 2 | Logout de todos los dispositivos | 7 | ✅ Done | 🔴 Alta | 1hs |
| 3 | Upload de imágenes (Cloudinary) | 8 | ✅ Done | 🟠 Media-alta | 4-6hs |
| 4 | Dashboard de estadísticas admin | 9 | ✅ Done | 🟠 Media | 4-6hs |
| 5 | Cursor pagination en orders | 10 | 🔲 Pendiente | 🟡 Baja | 3hs |
| 6 | Notificaciones en tiempo real (SSE) | 10 | 🔲 Pendiente | 🟡 Baja | 4hs |

**Pendiente:** ~7hs (solo Bloque 10, implementar cuando haya datos reales)
