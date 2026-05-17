# Módulo de Shop — Guía para el Negocio

## ¿Qué es el shop?

El shop es la parte del sistema que ven los clientes. Muestra el catálogo de productos y combos disponibles con el precio real a pagar — ya con descuentos e impuestos aplicados — y el stock actualizado. El cliente puede buscar, filtrar y ver el detalle de cada artículo antes de hacer un pedido.

## ¿Cómo funciona?

```
El cliente entra al shop
        ↓
Ve el catálogo con todos los productos y combos activos
        ↓
Puede buscar por nombre, filtrar por categoría, tipo o rango de precio
        ↓
Hace clic en un artículo y ve el detalle completo:
precio desglosado, stock disponible e imágenes
        ↓
Agrega el artículo a su pedido
```

## ¿Para qué sirve este módulo?

Es la ventana del negocio hacia los clientes. Todo lo que el admin configura — precios, descuentos, imágenes, stock — se refleja aquí en tiempo real. El cliente no gestiona nada: solo navega, consulta y compra.

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| El cliente navega el catálogo | Ve todos los productos y combos activos con precio final |
| El cliente busca un artículo | Escribe "coca" y el sistema muestra todo lo que coincide |
| El cliente filtra por sección | Selecciona "Bebidas" y ve solo los artículos de esa categoría |
| El cliente filtra por precio | Pone "hasta $500" y el shop muestra solo lo que entra en ese presupuesto |
| El cliente quiere ver solo productos o solo combos | Usa el filtro de tipo para ver una sola categoría de artículos |
| El cliente abre el detalle de un artículo | Ve imágenes, descripción, precio desglosado y cuántas unidades quedan |

## ¿Qué puede hacer un cliente?

| Acción | Descripción |
|---|---|
| Ver el catálogo | Lista paginada de todos los artículos disponibles con precio y stock |
| Buscar por nombre | Filtra el catálogo por texto libre |
| Filtrar por categoría | Ve solo los artículos de una sección del catálogo |
| Filtrar por tipo | Ve solo productos, o solo combos |
| Filtrar por rango de precio | Define un mínimo y/o máximo de precio final |
| Ver el detalle de un artículo | Precio completo desglosado, imágenes, stock y composición del combo |

El shop es público: no requiere que el cliente tenga cuenta ni esté identificado para navegar. Solo necesita autenticarse cuando va a hacer un pedido.

## Reglas importantes

- **Solo aparecen artículos activos** — los productos y combos desactivados por el admin no aparecen en el shop.
- **El precio mostrado es el precio final real** — incluye descuentos, márgenes e impuestos. No hay sorpresas en el checkout.
- **Si un artículo no tiene precio configurado, no aparece** — el sistema lo filtra automáticamente para evitar mostrar artículos sin precio.
- **La primera imagen es la portada** — el admin controla cuál aparece primero asignando posiciones a las imágenes.
- **El stock se muestra en tiempo real** — el cliente ve cuántas unidades quedan disponibles antes de agregar al carrito.
- **El filtro de precio se aplica sobre el precio final** — si un artículo tiene descuento, se filtra por el precio con descuento aplicado.

## Ejemplos del día a día

> **El cliente busca gaseosas:**
> Escribe "gaseosa" en el buscador o selecciona la categoría "Bebidas". El shop muestra todos los artículos que coinciden con precio final y stock disponible.

> **El cliente compara precios:**
> Usa el filtro de precio para ver solo lo que entra en su presupuesto. El sistema calcula el precio final de cada artículo (con descuentos e impuestos) y devuelve solo los que están dentro del rango.

> **El cliente abre un combo:**
> Hace clic en "Combo Familiar" y ve el detalle: qué productos lo componen, el precio original tachado, el precio con descuento y las imágenes del combo.

> **El cliente ve que un artículo está por agotarse:**
> El indicador de stock muestra "pocas unidades" cuando el stock está cerca del mínimo configurado por el admin.

## ¿Cómo se conecta con el resto del sistema?

El shop consume información de varios módulos para construir cada resultado:

- **Productos y combos** — el catálogo base, filtrado a los que están activos
- **Precios** — el precio base configurado por el admin
- **Descuentos** — descuentos aplicados al precio base
- **Márgenes e impuestos** — se aplican sobre el precio después del descuento para llegar al precio final
- **Imágenes** — las imágenes del producto o combo, ordenadas por posición
- **Stock** — cuántas unidades hay disponibles y en qué estado está el stock

Después del shop, el flujo continúa en el módulo de **pedidos**, donde el cliente formaliza la compra con los artículos que eligió.
