# Implementaciones Pendientes — Post Blocks 1-6

Bloques 1-6 completados. Este documento cubre las implementaciones pendientes para la versión de producción.
Ordenadas por prioridad de cara al desarrollo del frontend.

---

## Bloque 7 — Cuenta y sesión

Pequeño. Sin dependencias externas. Alta prioridad porque el frontend lo necesita en la pantalla de perfil.

### 1. Cambio de password autenticado

**Archivos:** `src/modules/auth/controllers/auth.controller.ts`, `src/modules/auth/services/auth.service.ts`

- Endpoint `PATCH /v1/auth/change-password` — requiere JWT (usuario logueado)
- Body: `{ currentPassword, newPassword }`
- Validar que `currentPassword` coincide con el hash actual via `bcrypt.compare()`
- Si no coincide → `400 Bad Request`
- Si coincide → hashear `newPassword` y guardar
- Diferencia con `reset-password`: ese flujo es sin auth (via token de email). Este es con auth, conociendo el password actual.

**Esfuerzo:** 2hs

---

### 2. Cerrar sesión en todos los dispositivos

**Archivos:** `src/modules/auth/controllers/auth.controller.ts`, `src/modules/auth/services/auth.service.ts`

- Endpoint `POST /v1/auth/logout-all` — requiere JWT
- Revoca todos los `RefreshTokenEntity` del usuario donde `revokedAt IS NULL`
- Útil cuando el usuario sospecha que su cuenta fue comprometida
- No invalida el access token actual (expira solo en 15min por diseño)

**Esfuerzo:** 1hs

---

## Bloque 8 — Imágenes (upload real)

Actualmente las imágenes de productos y combos son URLs externas guardadas como string. El frontend va a necesitar poder subir archivos reales.

### 3. Upload de imágenes con S3 / Cloudinary

**Archivos nuevos:** `src/modules/storage/storage.service.ts`, `src/modules/storage/storage.module.ts`

- Instalar: `npm install @aws-sdk/client-s3 multer @types/multer` (o SDK de Cloudinary)
- `StorageService.upload(file: Express.Multer.File): Promise<string>` — sube el archivo, devuelve la URL pública
- Endpoint `POST /v1/products/:id/images` acepta `multipart/form-data` con el archivo
- Endpoint `POST /v1/combos/:id/images` — igual
- Guardar la URL devuelta por S3/Cloudinary en `ProductImageEntity.url`
- Agregar `DELETE /v1/products/:id/images/:imageId` que borra el archivo del storage antes del soft delete

**Variables de entorno nuevas:**
```
STORAGE_PROVIDER=s3 | cloudinary
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
# o bien:
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**Esfuerzo:** 4-6hs

---

## Bloque 9 — Dashboard admin

El frontend va a necesitar una pantalla de métricas. Sin esto el panel de admin queda sin datos agregados.

### 4. Endpoints de estadísticas

**Archivos nuevos:** `src/modules/analytics/analytics.controller.ts`, `src/modules/analytics/analytics.service.ts`

- `GET /v1/analytics/orders` — resumen de órdenes:
  ```json
  {
    "total": 150,
    "byStatus": { "pending": 10, "confirmed": 30, "dispatched": 20, "delivered": 80, "cancelled": 10 },
    "totalRevenue": 450000,
    "revenueToday": 12000,
    "revenueThisMonth": 85000
  }
  ```

- `GET /v1/analytics/products/top` — top 10 productos más vendidos (por cantidad de unidades en órdenes entregadas)

- `GET /v1/analytics/stock/critical` — productos con stock por debajo del umbral crítico (reusa la lógica de alertas)

- Todos requieren `RoleType.ADMIN` o `SUPER_ADMIN`
- Usar QueryBuilder con agregaciones — no cargar todas las entidades en memoria

**Esfuerzo:** 4-6hs

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

| # | Feature | Bloque | Prioridad | Esfuerzo |
|---|---|---|---|---|
| 1 | Cambio de password autenticado | 7 | 🔴 Alta | 2hs |
| 2 | Logout de todos los dispositivos | 7 | 🔴 Alta | 1hs |
| 3 | Upload de imágenes (S3/Cloudinary) | 8 | 🟠 Media-alta | 4-6hs |
| 4 | Dashboard de estadísticas admin | 9 | 🟠 Media | 4-6hs |
| 5 | Cursor pagination en orders | 10 | 🟡 Baja | 3hs |
| 6 | Notificaciones en tiempo real (SSE) | 10 | 🟡 Baja | 4hs |

**Total estimado:** ~18-22hs
