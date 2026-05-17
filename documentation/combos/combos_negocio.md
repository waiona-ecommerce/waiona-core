# Módulo de Combos — Guía para el Negocio

## ¿Qué es un combo?

Un combo es un paquete de varios productos vendidos juntos bajo un nombre y precio especial. Por ejemplo, "Combo Familiar" puede incluir 2 Coca Cola 500ml y 1 Agua Mineral 1L. Los combos permiten al negocio ofrecer promociones agrupadas sin tener que gestionar cada producto por separado desde el shop.

## ¿Cómo funciona?

```
Admin crea el combo
        ↓
Le define un nombre, descripción y categoría
        ↓
Le agrega los productos que lo componen (y la cantidad de cada uno)
        ↓
Se le configura el precio especial (en el módulo de precios)
        ↓
El combo aparece en el shop junto con los productos individuales
```

## ¿Para qué sirve este módulo?

Permite al administrador armar paquetes de productos y ofrecerlos como una unidad en el shop. Es ideal para promociones, combos de temporada o agrupaciones habituales que los clientes suelen pedir juntos. El precio del combo se gestiona de forma independiente al precio de cada producto por separado.

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Se crea una promoción nueva | El admin arma "Combo Asado" con 4 gaseosas y 2 aguas |
| Se modifica el nombre o descripción | El admin actualiza "Combo Verano" a "Combo Verano 2026" |
| Se cambian los productos del combo | El admin reemplaza toda la lista de ítems del combo |
| Un combo deja de venderse temporalmente | El admin lo desactiva sin borrarlo |
| Un combo se discontinúa definitivamente | El admin lo elimina del catálogo |

## ¿Qué puede hacer un administrador?

| Acción | Descripción |
|---|---|
| Crear un combo | Define nombre, descripción, categoría y lista de productos con sus cantidades |
| Ver todos los combos | Lista paginada con nombre de categoría e ítems incluidos |
| Ver el detalle de un combo | Toda la información de un combo específico |
| Editar un combo | Modifica nombre, descripción, categoría, estado o reemplaza la lista de ítems |
| Reemplazar ítems | Envía una nueva lista completa de productos; el sistema elimina los anteriores y carga los nuevos |
| Desactivar un combo | Deja de aparecer en el shop pero no se borra |
| Eliminar un combo | Se retira del catálogo de forma definitiva (operación irreversible desde el shop) |

Solo los administradores y superadministradores pueden gestionar combos. Los clientes solo los pueden ver desde el shop.

## Reglas importantes

- **Un combo debe tener al menos un producto** — no se puede crear un combo vacío.
- **No se puede repetir el mismo producto en un combo** — si el admin intenta agregar "Coca Cola 500ml" dos veces, el sistema lo rechaza.
- **Todos los productos deben existir** — no se puede agregar al combo un producto que no esté en el catálogo.
- **La categoría debe existir** — no se puede asignar una categoría que no exista en el sistema.
- **No se puede borrar una categoría que tiene combos** — primero hay que reasignar o eliminar los combos.
- **Al reemplazar los ítems, se reemplaza la lista completa** — no se agregan ni quitan ítems individuales; se envía la nueva lista completa y el sistema la aplica de una vez.
- **Desactivar no es eliminar** — un combo desactivado no aparece en el shop, pero su historial y pedidos anteriores quedan intactos.
- **Los combos eliminados no desaparecen de la base de datos** — quedan guardados internamente para trazabilidad, pero no son visibles ni utilizables.

## Ejemplos del día a día

> **Crear un combo nuevo:**
> El admin entra al panel, completa el formulario con el nombre "Combo Asado", elige la categoría "Combos", escribe la descripción y agrega 4 Coca Cola 500ml y 2 Aguas Minerales 1L. El combo queda disponible para asignarle precio.

> **Cambiar los productos de un combo:**
> El admin edita "Combo Familiar" y envía una nueva lista de ítems: 2 Sprite 500ml y 1 Jugo Natural 1L. El sistema elimina los productos anteriores y carga los nuevos de una sola vez.

> **Desactivar un combo temporalmente:**
> El admin desactiva "Combo Verano" fuera de temporada. El combo deja de aparecer en el shop hasta que lo vuelva a activar.

> **Eliminar un combo descontinuado:**
> El admin elimina "Combo Navidad 2025". El combo desaparece del catálogo y del shop, pero queda registrado internamente.

## ¿Cómo se conecta con el resto del sistema?

Los combos son una unidad de venta alternativa a los productos individuales. Se les asigna un **precio base** desde el módulo de precios, **descuentos** desde el módulo de descuentos, e **impuestos** específicos desde el módulo de impuestos de combos. Las **imágenes** del combo se gestionan desde un módulo propio. Finalmente, los combos aparecen en el **shop** donde los clientes los pueden ver y agregar a sus pedidos, igual que los productos individuales.
