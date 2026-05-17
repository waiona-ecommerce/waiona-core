# Módulo de Márgenes — Guía para el Negocio

## ¿Qué es un margen?

Un margen es la **ganancia que el negocio agrega al costo de un producto** antes de mostrarle el precio final al cliente.

Por ejemplo: si un producto cuesta $100 y le aplicamos un margen del 20%, el cliente ve $120. Esos $20 son la ganancia del negocio antes de impuestos.

---

## ¿Cómo se calcula el precio final?

El sistema calcula el precio del cliente en pasos:

```
Precio de costo
  → se aplica el descuento (si hay)
  → se aplica el margen          ← este módulo
  → se aplican los impuestos
  → se aplica el cupón (si el cliente tiene uno)
  = Precio final que paga el cliente
```

---

## ¿Para qué sirve este módulo?

Permite que los administradores **creen y gestionen márgenes de ganancia** que luego se asignan a los productos o combos del catálogo.

En vez de definir la ganancia producto por producto, se crean márgenes reutilizables. Si mañana querés cambiar la ganancia de toda una línea de productos, solo cambiás el margen y se aplica automáticamente a todos los que lo usan.

---

## Tipos de márgenes

Hay dos formas de definir un margen:

| Tipo | Cómo funciona | Ejemplo |
|---|---|---|
| **Porcentual** | Se suma un porcentaje al costo | Margen del 20% sobre $100 → precio $120 |
| **Monto fijo** | Se suma un valor fijo al costo | Margen de $500 fijo sobre $2.000 → precio $2.500 |

---

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Productos de línea general | "Margen estándar 20%" aplicado a todos los productos comunes |
| Productos importados | "Importado fijo $500" para cubrir el costo de importación |
| Por tipo de categoría | Electrónica al 15%, Alimentos al 8% |
| Liquidación | Margen 0% para productos que se quieren sacar sin ganancia |

---

## ¿Qué puede hacer un administrador?

| Acción | Descripción |
|---|---|
| **Crear** un margen | Definir nombre, valor y si es porcentual o fijo |
| **Ver** la lista de márgenes | Todos los márgenes activos del sistema, con paginación |
| **Ver** un margen específico | Detalle de un margen por su identificador |
| **Editar** un margen | Cambiar el nombre, el valor o el tipo (parcialmente) |
| **Eliminar** un margen | Solo si no está siendo usado por ningún producto o combo |

> Solo los usuarios con rol **Administrador** o **Super Administrador** pueden realizar estas acciones. Los clientes no tienen acceso.

---

## Reglas importantes

- **El nombre debe ser único** — no pueden existir dos márgenes con el mismo nombre.
- **Un porcentaje no puede superar el 100%** — si el margen es porcentual, el valor máximo es 100.
- **No se puede eliminar un margen en uso** — si algún producto o combo tiene ese margen asignado, el sistema bloquea la eliminación y avisa. Primero hay que desasignarlo.
- **Los márgenes nunca se borran definitivamente** — quedan registrados en el historial del sistema (borrado lógico).

---

## Ejemplos del día a día

**Crear un margen estándar del 20%:**
> El administrador crea un margen llamado "General 20%", con valor 20 y tipo porcentual.
> Luego lo asigna a todos los productos de línea general.

**Crear un margen fijo para importados:**
> El administrador crea un margen llamado "Importado fijo", con valor 500 y tipo monto fijo.
> Todos los productos importados suman $500 al costo automáticamente.

**Actualizar el margen por temporada:**
> En temporada alta, el administrador edita "General 20%" y lo sube a 22%.
> Todos los productos que usan ese margen actualizan su precio automáticamente.

**Intentar eliminar un margen en uso:**
> El sistema no lo permite y muestra un aviso: "El margen está siendo usado por uno o más productos y no puede eliminarse."

---

## ¿Cómo se conecta con el resto del sistema?

Los márgenes son usados por el módulo de **Precios** (`Pricing`):

- Cada **producto** tiene configurado un precio base y un margen asignado.
- Cada **combo** también tiene configurado su propio precio base y margen.

El margen no vive dentro del producto — vive aparte y se reutiliza. Esto hace que sea fácil mantener precios consistentes en todo el catálogo.
