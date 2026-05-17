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

El módulo tiene cuatro partes:

| Parte | Para qué sirve |
|---|---|
| **Tipos de impuesto** | Agrupa los impuestos por categoría: IVA, Ingresos Brutos, etc. |
| **Impuestos** | Define el valor concreto de cada impuesto |
| **Impuestos de producto** | Asigna un impuesto específico a un producto |
| **Impuestos de combo** | Asigna un impuesto específico a un combo |

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

Cada impuesto pertenece a un tipo y define el valor que se cobra. Hay dos formas de definirlo:

| Tipo | Cómo funciona | Ejemplo |
|---|---|---|
| **Porcentual** | Se aplica un porcentaje sobre el precio | IVA 21%: sobre $100 → cobra $21 extra |
| **Monto fijo** | Se suma una cantidad fija en una moneda | Tasa fija de $50 ARS sin importar el precio |

Además, un impuesto puede ser **global** o **específico**:

| Modalidad | Qué significa |
|---|---|
| **Global** | Se aplica automáticamente a todos los productos y combos del sistema |
| **Específico** | Solo se aplica a los productos o combos a los que fue asignado explícitamente |

> Un impuesto global **no puede** asignarse manualmente a un producto o combo — ya aplica a todo.

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
| **Crear** un impuesto | Definir valor, si es porcentual o fijo, si es global, y a qué tipo pertenece |
| **Ver** la lista | Todos los impuestos de un tipo |
| **Ver** uno | Detalle por ID |
| **Editar** | Cambiar el valor, tipo o condición de global |
| **Eliminar** | Borrado lógico |

### Sobre impuestos de producto / combo

| Acción | Descripción |
|---|---|
| **Asignar** | Vincular un impuesto específico a un producto o combo |
| **Ver** la lista | Todos los impuestos asignados a un producto/combo |
| **Ver** uno | Detalle de una asignación |
| **Eliminar** | Quitar la asignación |

> Solo los usuarios con rol **Administrador** o **Super Administrador** pueden realizar estas acciones. Los clientes no tienen acceso.

---

## Reglas importantes

- **El código del tipo de impuesto debe ser único** — no pueden existir dos tipos con el mismo código (ej: no pueden existir dos `IVA`).
- **Un impuesto fijo necesita moneda** — si no es porcentual, se debe indicar la moneda (actualmente `ARS`).
- **Un impuesto porcentual no puede tener moneda** — son excluyentes.
- **Un impuesto global no se puede asignar a un producto o combo** — ya se aplica a todo automáticamente. El sistema bloquea esa acción.
- **Los registros nunca se borran definitivamente** — quedan en el historial del sistema (borrado lógico).

---

## Ejemplos del día a día

**Configurar el IVA del 21%:**
> El administrador crea el tipo `IVA` / `Impuesto al Valor Agregado`.
> Luego crea un impuesto porcentual con valor 21, lo marca como global.
> A partir de ese momento, todos los productos y combos incluyen el 21% de IVA en su precio.

**Configurar Ingresos Brutos para una categoría específica:**
> Se crea el tipo `IIBB` / `Ingresos Brutos`.
> Se crea el impuesto porcentual con valor 3, **sin marcar como global**.
> Se asigna manualmente solo a los productos de la categoría correspondiente.

**Crear una tasa fija:**
> El administrador crea el tipo `TM` / `Tasa Municipal`.
> Crea el impuesto como monto fijo de $50 ARS.
> Lo asigna a los productos que corresponda.

**Intentar asignar un impuesto global a un producto:**
> El sistema rechaza la operación: `"A global tax cannot be assigned to a specific product"`.

---

## ¿Cómo se conecta con el resto del sistema?

Los impuestos son consumidos por el módulo de **Cálculo de precios** (`CalculationService`):

```
Motor de cálculo
  └── lee todos los impuestos globales activos
  └── lee los impuestos específicos asignados al producto/combo
  └── aplica todos sobre el precio (después del margen)
  └── devuelve el precio final con impuestos incluidos
```

El cliente nunca ve los impuestos por separado — ya están incluidos en el precio final que se muestra.
