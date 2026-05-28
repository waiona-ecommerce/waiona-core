# Módulo de Impuestos — Guía para el Negocio

## ¿Qué es un impuesto?

Un impuesto es un **cargo adicional que se aplica sobre el precio de un producto o combo** antes de que el cliente realice el pago. Puede ser ordenado por ley (IVA, Ingresos Brutos) o definido internamente por el negocio.

---

## ¿Cómo se aplica en el precio final?

El sistema calcula el precio del cliente en pasos:

```
Precio de costo
  → se aplica el descuento (si hay)
  → se aplica el margen
  → se aplican los impuestos    ← este módulo
  → se aplica el cupón (si el cliente tiene uno)
  = Precio final que paga el cliente
```

---

## ¿Para qué sirve este módulo?

Permite que los administradores **gestionen todos los impuestos del negocio** de forma centralizada. En lugar de cargar el mismo impuesto producto por producto, se definen una sola vez y se reutilizan.

El módulo tiene tres partes:

| Parte | Para qué sirve |
|---|---|
| **Tipos de impuesto** | Agrupa los impuestos por categoría: IVA, Ingresos Brutos, etc. |
| **Impuestos** | Define el valor porcentual de cada impuesto |
| **Impuestos de producto** | Asigna un impuesto específico a un producto |

> Los combos **no tienen impuestos asignados directamente**. Heredan los impuestos de sus productos componentes de forma automática (ver sección _¿Cómo se calculan los impuestos de un combo?_).

---

## Tipos de impuesto

Un **tipo de impuesto** es simplemente una categoría que agrupa impuestos relacionados. Se identifica con un código corto y un nombre descriptivo.

| Ejemplo | Código | Nombre |
|---|---|---|
| IVA | `IVA` | Impuesto al Valor Agregado |
| Ingresos Brutos | `IIBB` | Ingresos Brutos |
| Tasa municipal | `TM` | Tasa Municipal |

---

## Impuestos

Todos los impuestos son **porcentuales**: se aplica un porcentaje sobre el precio del producto. El valor debe estar entre 0.01% y 100%.

| Ejemplo | Valor | Cómo funciona |
|---|---|---|
| IVA | 21% | Sobre $100 cobra $21 extra |
| IIBB | 3% | Sobre $100 cobra $3 extra |
| Tasa especial | 0.5% | Sobre $100 cobra $0.50 extra |

Además, un impuesto puede ser **global** o **específico**:

| Modalidad | Qué significa |
|---|---|
| **Global** | Se aplica automáticamente a todos los productos y combos del sistema |
| **Específico** | Solo se aplica a los productos a los que fue asignado explícitamente |

> Un impuesto global **no puede** asignarse manualmente a un producto — ya aplica a todo.

---

## ¿Qué puede hacer un administrador?

### Sobre tipos de impuesto

| Acción | Descripción |
|---|---|
| **Crear** un tipo | Definir código y nombre (ej: `IVA` / `Impuesto al Valor Agregado`) |
| **Ver** la lista | Tipos de impuesto paginados |
| **Ver** uno | Detalle por ID |
| **Editar** | Cambiar nombre o código |
| **Eliminar** | Borrar un tipo (solo si no tiene impuestos asociados activos) |

### Sobre impuestos

| Acción | Descripción |
|---|---|
| **Crear** un impuesto | Definir el porcentaje y si es global, dentro de un tipo de impuesto |
| **Ver** la lista | Todos los impuestos de un tipo |
| **Ver** uno | Detalle por ID |
| **Editar** | Cambiar el valor o la condición de global |
| **Eliminar** | Borrado lógico |

### Sobre impuestos de producto

| Acción | Descripción |
|---|---|
| **Asignar** | Vincular un impuesto específico a un producto |
| **Ver** la lista | Todos los impuestos asignados a un producto |
| **Ver** uno | Detalle de una asignación |
| **Eliminar** | Quitar la asignación |

> Solo los usuarios con rol **Administrador** o **Super Administrador** pueden realizar estas acciones. Los clientes no tienen acceso.

---

## Reglas importantes

- **El código del tipo de impuesto debe ser único** — no pueden existir dos tipos con el mismo código (ej: no pueden existir dos `IVA`).
- **Todos los impuestos son porcentuales** — el valor debe estar entre 0.01% y 100%.
- **Un impuesto global no se puede asignar a un producto** — ya se aplica a todo automáticamente. El sistema bloquea esa acción.
- **Los registros nunca se borran definitivamente** — quedan en el historial del sistema (borrado lógico).

---

## Ejemplos del día a día

**Configurar el IVA del 21%:**
> El administrador crea el tipo `IVA` / `Impuesto al Valor Agregado`.
> Luego crea un impuesto con valor 21, lo marca como global.
> A partir de ese momento, todos los productos y combos incluyen el 21% de IVA en su precio.

**Configurar Ingresos Brutos para una categoría específica:**
> Se crea el tipo `IIBB` / `Ingresos Brutos`.
> Se crea el impuesto con valor 3, **sin marcar como global**.
> Se asigna manualmente solo a los productos de la categoría correspondiente.

**Intentar asignar un impuesto global a un producto:**
> El sistema rechaza la operación: `"A global tax cannot be assigned to a specific product"`.

---

## ¿Cómo se calculan los impuestos de un combo?

Un combo tiene un precio único ("combo $1.000"), pero sus productos componentes pueden tener impuestos específicos distintos (por ejemplo, IIBB diferente por categoría). El sistema resuelve esto con **prorrateo lineal**:

1. Se toma el precio de referencia de cada producto del combo (su precio unitario × cantidad).
2. Se calcula qué porcentaje representa cada producto sobre el total de referencia.
3. El precio del combo se distribuye en esa misma proporción.
4. El impuesto específico de cada producto se aplica sobre su parte proporcional del precio del combo.
5. Los impuestos globales (IVA) se aplican sobre el precio total del combo, una sola vez.

**Ejemplo — Combo $1.000 con Café ($800) y Pan ($400):**

| Producto | Precio ref | Proporción | Base prorrateada | IIBB |
|---|---|---|---|---|
| Café | $800 | 66,7% | $666,67 | 3% → $20 |
| Pan | $400 | 33,3% | $333,33 | 5% → $16,67 |
| IVA global 21% | — | — | $1.000 (precio combo) | $210 |
| **Total impuestos** | | | | **$246,67** |

> Este cálculo es automático. No hay que asignar impuestos al combo — alcanza con asignarlos a cada producto.

---

## ¿Cómo se conecta con el resto del sistema?

Los impuestos son consumidos por el módulo de **Cálculo de precios** (`CalculationService`):

```
Motor de cálculo
  └── lee todos los impuestos globales activos
  └── para productos: lee los impuestos específicos asignados al producto
  └── para combos: aplica prorrateo sobre los productos componentes
  └── aplica todos sobre el precio (después del margen)
  └── devuelve el precio final con impuestos incluidos
```

El cliente nunca ve los impuestos por separado — ya están incluidos en el precio final que se muestra.
