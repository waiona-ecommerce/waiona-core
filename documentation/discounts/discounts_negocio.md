# Módulo de Descuentos — Guía para el Negocio

## ¿Qué es un descuento?

Un descuento es una **reducción de precio que el negocio aplica a uno o más productos o combos**. Cuando un cliente ve un producto con descuento, el precio que le mostramos ya tiene esa reducción aplicada.

Por ejemplo: si un producto cuesta $1.000 y le aplicamos un descuento del 20%, el cliente ve $800.

---

## ¿Cómo encaja el descuento en el precio final?

El sistema calcula el precio del cliente en pasos:

```
Precio de costo
  → se aplica el descuento        ← este módulo
  → se aplica el margen de ganancia
  → se aplican los impuestos
  → se aplica el cupón (si el cliente tiene uno)
  = Precio final que paga el cliente
```

---

## ¿Para qué sirve este módulo?

Permite que los administradores **creen descuentos y los asignen a productos o combos específicos del catálogo**.

Un descuento puede:
- Tener una fecha de inicio y una fecha de vencimiento (o ninguna, siendo permanente)
- Ser un porcentaje (`20% off`) o un monto fijo (`$500 off`)
- Aplicarse a uno o varios productos y combos a la vez

---

## Tipos de descuento

| Tipo | Cómo funciona | Ejemplo |
|---|---|---|
| **Porcentual** | Se descuenta un porcentaje del precio | 20% off sobre $1.000 → precio $800 |
| **Monto fijo** | Se descuenta un valor fijo del precio | $500 off sobre $2.000 → precio $1.500 |

---

## Estados de un descuento

Cada descuento tiene un estado que el sistema calcula automáticamente según las fechas:

| Estado | Significado |
|---|---|
| **Activo** | El descuento está vigente ahora mismo |
| **Programado** | El descuento existe pero aún no arrancó |
| **Vencido** | El descuento ya terminó |

Un descuento sin fechas siempre está **activo**.

---

## ¿Cuándo se usa en el negocio?

| Situación | Ejemplo de uso |
|---|---|
| Campaña estacional | "Black Friday 20%" del 1 al 30 de noviembre |
| Oferta de lanzamiento | "$500 off" en productos nuevos, sin fecha de fin |
| Liquidación de stock | "30% off" en productos seleccionados |
| Promos de combo | "15% off" aplicado a combos de temporada |

---

## ¿Qué puede hacer un administrador?

### Sobre los descuentos

| Acción | Descripción |
|---|---|
| **Crear** un descuento | Definir nombre, tipo (porcentual o fijo), valor y fechas opcionales |
| **Ver** la lista de descuentos | Todos los descuentos activos del sistema, con su estado actual |
| **Ver** un descuento específico | Detalle completo con estado calculado en tiempo real |
| **Editar** un descuento | Cambiar cualquier campo parcialmente (nombre, fechas, valor, etc.) |
| **Eliminar** un descuento | El descuento desaparece del sistema sin borrar el historial |

### Sobre los productos asignados

| Acción | Descripción |
|---|---|
| **Asignar** un producto | Vincular un producto existente a un descuento |
| **Ver** los productos asignados | Listar todos los productos que están bajo ese descuento |
| **Quitar** un producto | Desasignar el producto del descuento |

### Sobre los combos asignados

| Acción | Descripción |
|---|---|
| **Asignar** un combo | Vincular un combo existente a un descuento |
| **Ver** los combos asignados | Listar todos los combos que están bajo ese descuento |
| **Quitar** un combo | Desasignar el combo del descuento |

> Solo los usuarios con rol **Administrador** o **Super Administrador** pueden realizar estas acciones. Los clientes no tienen acceso.

---

## Reglas importantes

- **Un producto solo puede tener un descuento activo a la vez** — si el producto "Hamburguesa" ya está en el descuento "Black Friday", no se puede asignar también al descuento "Promo Verano". Primero hay que quitarlo de uno antes de ponerlo en otro.

- **Un combo solo puede tener un descuento activo a la vez** — igual que los productos.

- **El porcentaje no puede superar el 100%** — si el descuento es porcentual, el valor máximo es 100.

- **Un descuento de monto fijo debe indicar la moneda** — si el descuento no es porcentual, hay que especificar en qué moneda está expresado (por ejemplo, ARS).

- **Las fechas deben tener sentido** — si se define fecha de inicio y de fin, la de inicio debe ser anterior a la de fin. El sistema rechaza rangos vacíos o invertidos.

- **Los descuentos nunca se borran definitivamente** — quedan registrados en el historial del sistema (borrado lógico). Si se elimina un producto o combo, sus asignaciones de descuento desaparecen automáticamente.

- **Un producto quitado puede reasignarse a otro descuento** — si se quita un producto de un descuento, queda libre para asignarse a uno distinto.

---

## Ejemplos del día a día

**Crear un descuento para Black Friday:**
> El administrador crea un descuento llamado "Black Friday 20%", con valor 20 y tipo porcentual.
> Define el 1 de noviembre como inicio y el 30 de noviembre como fin.
> Luego asigna los productos que participan de la promo.

**Crear un descuento de monto fijo permanente:**
> El administrador crea un descuento llamado "Oferta fija $500", con valor 500, tipo monto fijo y moneda ARS.
> Sin fechas → el descuento queda activo indefinidamente hasta que lo eliminen.

**Intentar asignar un producto que ya tiene descuento:**
> El sistema no lo permite y avisa: "El producto ya tiene un descuento activo asignado."
> Primero hay que quitar el producto del descuento anterior.

**Quitar un producto de un descuento y reasignarlo:**
> El administrador quita "Hamburguesa" del descuento "Black Friday" (DELETE target).
> Luego puede asignarla al descuento "Promo Verano" sin problema.

**Editar las fechas de un descuento:**
> El administrador edita el descuento "Black Friday" para extender la fecha de fin al 5 de diciembre.
> El sistema actualiza el estado automáticamente — si todavía no llegó, sigue como "Programado".

---

## ¿Cómo se conecta con el resto del sistema?

Los descuentos son consumidos por el **motor de cálculo de precios** (`Calculation`):

- Cuando se crea un pedido, el sistema busca si el producto o combo tiene un descuento activo asignado.
- Si lo tiene, aplica la reducción antes de calcular el margen y los impuestos.
- El precio tachado que ve el cliente en el catálogo es el precio **sin descuento** — el precio real ya lo incluye.

```
Catálogo del cliente:
  ~~$1.000~~  → $800   (descuento 20% Black Friday aplicado)
```
