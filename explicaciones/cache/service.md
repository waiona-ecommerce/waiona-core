## Cache en el Shop

El proyecto usa `@nestjs/cache-manager` con Redis (configurado globalmente en `app.module.ts`).

---

## Approach actual: CacheInterceptor oficial de NestJS

Se usa el interceptor oficial de NestJS para cachear la respuesta HTTP completa de endpoints que cumplen estas condiciones:

- Datos **estructurales** que casi nunca cambian
- Sin consecuencias económicas si están desactualizados unos minutos
- Un TTL es suficiente — no se necesita invalidación inmediata

### Endpoint cacheado: `GET /v1/shop/categories`

```ts
// shop.controller.ts
@Get('categories')
@UseInterceptors(CacheInterceptor)
@CacheKey('shop:categories')
@CacheTTL(300_000) // 5 minutos
async getCategories(): Promise<CategoryTreeResponseDto[]> {
  return this.shopService.getCategories();
}
```

- `CacheInterceptor` intercepta la respuesta y la guarda en Redis con la key `shop:categories`
- Las siguientes requests devuelven el valor de Redis sin tocar la DB
- A los 5 minutos expira solo — si un admin crea o renombra una categoría, aparece en el próximo ciclo

---

## Por qué se eligió el interceptor oficial aquí

El interceptor oficial cachea la **respuesta HTTP completa**. Funciona bien cuando:

- No necesitás invalidación manual — el TTL alcanza
- La key es fija (no depende de parámetros que varían por usuario)
- El endpoint es de solo lectura y el costo de datos levemente viejos es bajo

Las categorías cumplen todo eso: son datos de estructura (nombre, jerarquía), un admin las crea raramente, y si el frontend ve las categorías de hace 5 minutos no hay ningún impacto real.

---

## Por qué NO se cachean los otros endpoints del shop

| Endpoint | Motivo |
|---|---|
| `GET /shop/items` | Precio y stock cambian constantemente — datos viejos generan inconsistencias |
| `GET /shop/items/:id` | Ídem — el precio del detalle debe ser el real al momento de ver el producto |

La regla: **cachear solo cuando el costo de datos viejos es bajo**.

---

## Por qué NO se usa el interceptor oficial en categories (admin)

Los endpoints `GET /v1/categories` del módulo de administración son `@Roles(ADMIN)`. El cache del shop es para el usuario final — no aplica a endpoints de gestión interna.

---

## Preguntas de comprensión

1. ¿Qué pasa si un admin agrega una nueva categoría mientras el cache está activo?
2. ¿Por qué `@CacheKey` es necesario acá? ¿Qué pasaría sin él?
3. ¿Por qué el interceptor oficial no sirve para `GET /shop/items`?
4. ¿Dónde está configurado Redis para que el `CacheInterceptor` lo use?

---

## Respuestas

1. La nueva categoría no aparece hasta que expire el TTL (5 minutos). Es aceptable porque las categorías se crean raramente y no hay impacto económico.
2. Sin `@CacheKey`, el interceptor usa la URL como key (`/v1/shop/categories`). Funciona igual en este caso. Se pone explícito para tener control claro sobre la key y poder referirla si en el futuro hace falta invalidación manual.
3. Porque el precio y el stock son datos en vivo. Cachear la respuesta completa mostraría precios o stock desactualizados al cliente — potencialmente inconsistente con lo que se cobra en `POST /orders`.
4. En `app.module.ts`, `CacheModule.registerAsync` con `redisStore` y `isGlobal: true`. Al ser global, el `CacheInterceptor` lo usa automáticamente sin importar nada extra.
