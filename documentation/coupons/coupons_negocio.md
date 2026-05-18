# Módulo de Cupones — Guía para el Negocio

## ¿Qué es un cupón?

Un cupón es un **código promocional que el cliente ingresa al momento de hacer su pedido** para obtener un descuento sobre el total a pagar. A diferencia de los descuentos que se aplican automáticamente a los productos, el cupón requiere que el cliente conozca y use el código correctamente.

Por ejemplo: el cliente tiene el código "VERANO10" y lo ingresa al finalizar su compra. Si el carrito suma $5.000, el sistema le aplica un 10% de descuento y le cobra $4.500.

---

## ¿Cómo encaja el cupón en el precio final?

El sistema calcula el precio del cliente en pasos. El cupón es lo último que se aplica:

```
Precio de costo del producto
  → se aplica el descuento del producto (si tiene)
  → se aplica el margen de ganancia
  → se aplican los impuestos
  → se aplica el cupón del cliente       ← este módulo
  = Total que paga el cliente
```

El precio que ve el cliente en el catálogo ya incluye descuentos, márgenes e impuestos. El cupón reduce ese total final al momento de confirmar el pedido.

---

## ¿Para qué sirve este módulo?

Permite que los administradores **creen códigos de cupón, los configuren y controlen su uso**. Con este módulo se puede:

- Crear códigos para campañas de marketing, fidelización o promociones puntuales
- Definir si el cupón aplica a todo el catálogo o solo a productos y combos específicos
- Limitar cuántas veces se puede usar en total
- Definir fechas de vigencia
- Consultar quién usó cada cupón y en qué orden

---

## Tipos de cupón

| Tipo | Cómo funciona | Ejemplo |
|---|---|---|
| **Porcentual** | Se descuenta un porcentaje del total | 10% off sobre $5.000 → paga $4.500 |
| **Monto fijo** | Se descuenta un monto exacto del total | $500 off sobre $5.000 → paga $4.500 |

---

## ¿A qué aplica el cupón?

| Alcance | Descripción |
|---|---|
| **Global** | El cupón aplica a cualquier producto o combo del catálogo |
| **Dirigido** | El cupón solo aplica a los productos y/o combos que el admin le asigna específicamente |

Un cupón global no puede tener productos o combos asignados — aplica a todo por definición. Un cupón dirigido debe tener al menos un producto o combo asignado para poder ser utilizado.

---

## Estados de un cupón

Cada cupón tiene un estado que el sistema calcula automáticamente:

| Estado | Significado |
|---|---|
| **Activo** | El cupón está vigente y puede usarse ahora mismo |
| **Programado** | El cupón existe pero su fecha de inicio aún no llegó |
| **Vencido** | El cupón ya superó su fecha de fin |
| **Agotado** | Se alcanzó el límite máximo de usos definido |

Un cupón sin fechas ni límite de uso siempre está **activo**.

---

## ¿Cuándo se usa en el negocio?

| Situación | Ejemplo de uso |
|---|---|
| Campaña de bienvenida | "BIENVENIDO10" — 10% off para el primer pedido de nuevos usuarios |
| Promoción de temporada | "VERANO500" — $500 off del 1 al 31 de enero |
| Promo relámpago con límite | "FLASH20" — 20% off, solo los primeros 50 clientes |
| Fidelización | "GRACIAS15" — 15% off enviado a clientes frecuentes |
| Liquidación dirigida | "LIQPIZZA" — $200 off solo en pizzas seleccionadas del catálogo |

---

## ¿Qué puede hacer un administrador?

### Sobre los cupones

| Acción | Descripción |
|---|---|
| **Crear** un cupón | Definir código, tipo (porcentual o fijo), valor, alcance y configuración opcional de límite y fechas |
| **Ver** la lista de cupones | Todos los cupones del sistema con su estado actual |
| **Ver** un cupón específico | Detalle completo: código, usos registrados, estado, vigencia |
| **Editar** un cupón | Cambiar cualquier campo parcialmente: fechas, límite de uso, valor, etc. |
| **Eliminar** un cupón | El cupón deja de estar disponible sin borrar el historial de usos |

### Sobre los productos y combos asignados (cupones dirigidos)

| Acción | Descripción |
|---|---|
| **Asignar** un producto | Agregar un producto al alcance del cupón |
| **Ver** los productos asignados | Listar todos los productos que están cubiertos por ese cupón |
| **Quitar** un producto | Sacar un producto del alcance del cupón |
| **Asignar** un combo | Agregar un combo al alcance del cupón |
| **Ver** los combos asignados | Listar todos los combos cubiertos por ese cupón |
| **Quitar** un combo | Sacar un combo del alcance del cupón |

### Sobre los usos registrados

| Acción | Descripción |
|---|---|
| **Ver** todos los usos | Lista paginada de todos los cupones aplicados en órdenes |
| **Ver** usos por cupón | Todos los pedidos en los que se usó un código específico |
| **Ver** usos por usuario | Todos los cupones que usó un cliente determinado |

> Solo los usuarios con rol **Administrador** o **Super Administrador** pueden realizar estas acciones. Los clientes no tienen acceso a estos paneles.

---

## Reglas importantes

- **El código es único** — no pueden existir dos cupones con el mismo código en el sistema.

- **Cada cliente solo puede usar cada cupón una vez** — si el cliente ya usó el código "VERANO10", el sistema lo rechaza si intenta usarlo en un segundo pedido.

- **Los cupones globales no pueden tener productos asignados** — si un cupón aplica a todo el catálogo, no tiene sentido asignarle productos específicos. El sistema bloquea esa combinación.

- **El porcentaje no puede superar el 100%** — si el cupón es porcentual, el valor máximo es 100.

- **Un cupón de monto fijo debe indicar la moneda** — hay que especificar en qué moneda está expresado el descuento (por ejemplo, pesos argentinos).

- **Las fechas deben tener sentido** — si se define fecha de inicio y de fin, la de inicio debe ser anterior a la de fin. El sistema rechaza rangos inválidos.

- **El límite de uso es opcional** — si no se define, el cupón puede usarse sin restricción de cantidad.

- **Los usos se controlan con seguridad** — cuando dos clientes intentan usar el último uso disponible de un cupón al mismo tiempo, el sistema garantiza que solo uno lo logra. No puede pasar que el límite se supere por pedidos simultáneos.

- **Los cupones nunca se borran definitivamente** — quedan en el historial aunque se eliminen. Los usos registrados tampoco desaparecen.

---

## Ejemplos del día a día

**Crear un cupón de bienvenida sin límite:**
> El administrador crea el cupón "BIENVENIDO10" con 10% de descuento, tipo porcentual, alcance global y sin fechas ni límite. Cualquier cliente puede usarlo una vez para cualquier pedido, indefinidamente.

**Crear una promo relámpago limitada:**
> El administrador crea el cupón "FLASH100" con $100 de descuento, moneda ARS, alcance global y límite de 50 usos. Una vez que 50 clientes lo usen, el sistema muestra el estado "Agotado" y no acepta nuevos usos.

**Crear un cupón dirigido a productos específicos:**
> El administrador crea el cupón "LIQPIZZA" con 20% de descuento, alcance dirigido. Luego asigna al cupón los productos de pizza que quiere incluir. Solo los pedidos que contengan esos productos específicos pueden usar el código.

**Quitar un producto del alcance de un cupón:**
> El administrador quita "Hamburguesa XXL" del cupón "FLASH100". A partir de ese momento, el código ya no aplica a ese producto en nuevos pedidos.

**Ver quién usó un cupón:**
> El administrador consulta los usos del código "VERANO10" y ve la lista de órdenes en las que se aplicó, con fecha y usuario.

**Extender la vigencia de un cupón:**
> El cupón "NAVIDAD15" estaba configurado hasta el 31 de diciembre. El administrador lo edita y extiende la fecha de fin al 6 de enero. El sistema actualiza el estado automáticamente.

**Intentar usar un cupón ya utilizado:**
> Un cliente intenta usar el código "BIENVENIDO10" en su segundo pedido. El sistema lo rechaza y le informa que ya utilizó ese cupón anteriormente.

---

## ¿Cómo se conecta con el resto del sistema?

Los cupones se integran en dos puntos clave del sistema:

**Con el motor de precios:** cuando el sistema necesita calcular el total de un pedido con cupón, consulta el módulo de cupones para validar el código y obtener el valor del descuento a aplicar sobre el total ya calculado (con descuentos, margen e impuestos incluidos).

**Con el módulo de órdenes:** cuando un cliente confirma su pedido ingresando un cupón, el sistema de órdenes registra automáticamente el uso del código, descuenta del total y bloquea que ese cliente vuelva a usarlo. Todo esto ocurre de forma segura y atómica: o se completa todo junto, o no se aplica nada.

```
Cliente confirma pedido con código "VERANO10"
  → Módulo de Órdenes valida el cupón
  → Motor de Precios calcula el descuento
  → Módulo de Cupones registra el uso (atómico, seguro)
  → Orden creada con precio final reducido
```
