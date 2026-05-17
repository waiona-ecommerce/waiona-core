# Módulo de Productos — Guía para el Negocio

## ¿Qué es un producto?

Un producto es cualquier artículo que el negocio vende a sus clientes. Por ejemplo, "Coca Cola 500ml", "Agua Mineral 1L" o "Pan Integral". Cada producto tiene un código único (SKU), un nombre, una descripción y pertenece a una categoría del catálogo. Los productos son la base de todo: se les asigna precio, stock, imágenes, descuentos e impuestos.

## ¿Cómo funciona?

```
Admin crea el producto
        ↓
Le asigna una categoría (ej: Bebidas)
        ↓
Le configura el precio base (en el módulo de precios)
        ↓
Le asigna stock (en el módulo de stock)
        ↓
El producto aparece en el shop para que los clientes lo vean y lo compren
```

## ¿Para qué sirve este módulo?

Permite al administrador mantener actualizado el catálogo de artículos disponibles. Sin productos no hay nada que vender: son la unidad fundamental del sistema. Todo lo demás — precios, stock, descuentos, pedidos — depende de que los productos estén bien cargados.

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Se suma un nuevo artículo al catálogo | El admin carga "Sprite 500ml" con su categoría y código único |
| Se cambia el nombre o descripción de un ítem | El admin actualiza "Coca Light" a "Coca Cola Zero Azúcar" |
| Un artículo deja de venderse temporalmente | El admin lo desactiva sin borrarlo del sistema |
| Un artículo se discontinúa definitivamente | El admin lo elimina del catálogo (queda en el historial interno) |
| Se reorganiza el catálogo | El admin cambia la categoría de varios productos |

## ¿Qué puede hacer un administrador?

| Acción | Descripción |
|---|---|
| Crear un producto | Carga nombre, descripción, código único, categoría y unidad de medida |
| Ver todos los productos | Lista paginada con nombre de categoría incluido |
| Ver el detalle de un producto | Toda la información de un artículo específico |
| Editar un producto | Modifica cualquier campo: nombre, descripción, categoría, estado, etc. |
| Desactivar un producto | El artículo deja de aparecer en el shop pero no se borra |
| Eliminar un producto | Se retira del catálogo de forma definitiva (operación irreversible desde el shop) |

Solo los administradores y superadministradores pueden gestionar productos. Los clientes solo los pueden ver desde el shop.

## Reglas importantes

- **El código SKU es único** — no pueden existir dos productos con el mismo código. Si se intenta, el sistema lo rechaza.
- **El SKU siempre se guarda en mayúsculas** — "coca-500" y "COCA-500" son el mismo código.
- **La categoría debe existir** — no se puede crear un producto en una categoría que no existe.
- **No se puede borrar una categoría que tiene productos** — primero hay que reasignar o eliminar los productos.
- **Desactivar no es eliminar** — un producto desactivado no aparece en el shop, pero su historial y pedidos anteriores quedan intactos.
- **Los productos eliminados no desaparecen de la base de datos** — quedan guardados internamente para trazabilidad, pero no son visibles ni utilizables.

## Ejemplos del día a día

> **Cargar un nuevo producto:**
> El admin entra al panel, completa el formulario con el nombre "Sprite 500ml", elige la categoría "Bebidas", escribe el código "SPRITE-500" y confirma. El producto queda disponible para asignarle precio y stock.

> **Actualizar el nombre de un producto:**
> El admin busca "Coca Light" en el listado, hace clic en editar, cambia el nombre a "Coca Cola Zero Azúcar" y guarda. El cambio se refleja de inmediato en el shop.

> **Desactivar un producto temporalmente:**
> El admin encuentra un artículo con problema de stock, lo desactiva. El producto deja de aparecer en el shop hasta que el admin lo vuelva a activar.

> **Eliminar un producto discontinuado:**
> El admin elimina "Jugo Tang Naranja" que ya no se vende. El producto desaparece del catálogo y del shop, pero queda registrado internamente.

## Imágenes del producto

Cada producto puede tener varias imágenes cargadas. Las imágenes se ordenan por posición: la primera (posición más baja) es la que aparece como portada en el shop cuando el cliente navega el catálogo. Las demás se pueden ver en el detalle del producto.

| Acción | Descripción |
|---|---|
| Agregar una imagen | El admin sube la URL de la imagen y le asigna una posición |
| Ver las imágenes de un producto | Lista ordenada por posición |
| Cambiar la posición de una imagen | El admin edita la imagen y cambia el número de posición |
| Eliminar una imagen | La imagen desaparece del shop pero queda registrada internamente |

**Regla importante:** no se puede eliminar un producto que todavía tiene imágenes activas. Primero hay que eliminar las imágenes.

## ¿Cómo se conecta con el resto del sistema?

Los productos son el núcleo del catálogo. Al producto se le asigna un **precio base** desde el módulo de precios, **descuentos** desde el módulo de descuentos, e **impuestos** desde el módulo de impuestos. El módulo de **stock** controla cuántas unidades hay disponibles. Las **imágenes** del producto se cargan directamente sobre el producto y se muestran en el **shop**. Finalmente, los productos aparecen en el shop donde los clientes los pueden ver y agregar a sus pedidos. También pueden formar parte de **combos**, que son paquetes de múltiples productos vendidos juntos a un precio especial.
