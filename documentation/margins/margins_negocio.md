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

## Tipo de margen

Los márgenes son siempre porcentuales:

| Tipo | Cómo funciona | Ejemplo |
|---|---|---|
| **Porcentual** | Se suma un porcentaje al costo | Margen del 20% sobre $100 → precio $120 |

El valor mínimo es 0.01% y el máximo es 1000%.

---

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Productos de línea general | "Margen estándar 20%" aplicado a todos los productos comunes |
| Por tipo de categoría | Electrónica al 15%, Alimentos al 8% |
| Margen alto en productos de nicho | Hasta 1000% para artículos de muy alta demanda |

---

## ¿Qué puede hacer un administrador?

| Acción | Descripción |
|---|---|
| **Crear** un margen | Definir nombre y valor porcentual |
| **Ver** la lista de márgenes | Todos los márgenes activos del sistema, con paginación |
| **Ver** un margen específico | Detalle de un margen por su identificador |
| **Editar** un margen | Cambiar el nombre, el valor o el tipo (parcialmente) |
| **Eliminar** un margen | Solo si no está siendo usado por ningún producto o combo |

> Solo los usuarios con rol **Administrador** o **Super Administrador** pueden realizar estas acciones. Los clientes no tienen acceso.

---

## Reglas importantes

- **El nombre debe ser único** — no pueden existir dos márgenes con el mismo nombre.
- **El valor es siempre porcentual** — mínimo 0.01%, máximo 1000%.
- **No se puede eliminar un margen en uso** — si algún producto o combo tiene ese margen asignado, el sistema bloquea la eliminación y avisa. Primero hay que desasignarlo.
- **Los márgenes nunca se borran definitivamente** — quedan registrados en el historial del sistema (borrado lógico).

---

## Ejemplos del día a día

**Crear un margen estándar del 20%:**
> El administrador crea un margen llamado "General 20%", con valor 20.
> Luego lo asigna a todos los productos de línea general.

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
