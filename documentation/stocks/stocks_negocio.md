# Módulo de Stocks — Guía para el Negocio

## ¿Qué es el módulo de stocks?

El módulo de stocks es el sistema que lleva la cuenta de cuántos productos tiene el negocio, dónde están guardados y qué pasó con cada unidad. Funciona como el inventario digital del negocio: sabe cuánto hay, cuánto está comprometido por pedidos en curso y cuánto está realmente disponible para vender.

Por ejemplo: si el negocio tiene 100 notebooks en el depósito y hay 5 órdenes en proceso sin despachar todavía, el sistema muestra 95 disponibles — los otros 5 están "reservados" hasta que se despachen o se cancelen los pedidos.

---

## ¿Cómo funciona el inventario?

```
Mercadería llega al depósito
  → El administrador carga la entrada
  → El stock sube

Cliente hace un pedido
  → El sistema reserva las unidades automáticamente
  → El stock disponible baja, pero el stock físico no cambia todavía

Admin despacha el pedido
  → El stock físico se descuenta
  → La reserva se cancela

Admin cancela el pedido
  → La reserva se libera
  → El stock disponible vuelve a subir
```

---

## ¿Para qué sirve este módulo?

Le permite al negocio tener control total del inventario sin errores manuales. Sabe exactamente cuánto tiene, dónde está cada producto, qué pasó en cada momento y quién hizo cada cosa. También evita que se venda algo que no hay: si el stock disponible es cero, el sistema no permite hacer más pedidos de ese producto.

---

## Partes del sistema de inventario

| Parte | Para qué sirve |
|---|---|
| **Ubicaciones** | Define los lugares físicos donde se guarda mercadería (depósitos, sucursales, etc.) |
| **Ítems de stock** | Representa un producto en una ubicación específica, con su cantidad actual |
| **Movimientos** | Registro histórico e inmutable de cada entrada, salida o ajuste de stock |
| **Bajas por daño** | Registro formal de mercadería dada de baja con motivo, descripción e imágenes |

---

## Tipos de ubicaciones

| Tipo | Descripción | Ejemplo |
|---|---|---|
| Depósito | Almacén central, sin atención al público | "Depósito Central Norte" |
| Sucursal | Local de venta o punto de entrega | "Sucursal Palermo" |
| Virtual | Ubicación lógica sin espacio físico propio | "Stock en tránsito" |

---

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Llega mercadería nueva | Se carga la entrada de 200 unidades en el depósito central |
| Se abre una nueva sucursal | Se crea la ubicación y se carga el stock inicial |
| Cliente hace un pedido | El sistema reserva las unidades automáticamente al confirmar |
| Se despacha un pedido | El sistema descuenta el stock físico y libera la reserva |
| Se cancela un pedido | El sistema libera las unidades reservadas sin tocar el stock físico |
| Se rompen o vencen productos | El administrador registra una baja formal con motivo y evidencia fotográfica |
| Se ajusta un conteo erróneo | El administrador registra un ajuste con la diferencia |
| Se consulta el stock en la tienda | Los clientes ven si hay disponibilidad en tiempo real |

---

## ¿Qué puede hacer un administrador?

| Acción | Descripción |
|---|---|
| Crear una ubicación | Registrar un nuevo depósito o sucursal con nombre y dirección |
| Modificar una ubicación | Actualizar el nombre, tipo o dirección de una ubicación existente |
| Eliminar una ubicación | Dar de baja una ubicación (solo si no tiene productos asignados) |
| Registrar un producto en una ubicación | Crear el ítem de stock con los niveles de alerta correspondientes |
| Cargar mercadería | Agregar unidades al stock de un producto en una ubicación |
| Registrar una baja simple | Descontar unidades por un ajuste de inventario |
| Registrar una baja por daño | Descontar unidades dañadas, vencidas o perdidas con motivo y adjuntos |
| Actualizar niveles de alerta | Cambiar los umbrales mínimo y crítico para las notificaciones |
| Ver el historial de movimientos | Consultar todas las entradas y salidas de un producto |
| Ver el historial de bajas | Consultar todas las bajas registradas con sus motivos |

Todas las acciones requieren acceso de administrador. Los clientes no pueden ver ni modificar el inventario directamente — solo ven si hay stock disponible en la tienda.

---

## Niveles de alerta de stock

Cada ítem de stock tiene dos umbrales configurables:

| Nivel | Qué significa |
|---|---|
| **Stock mínimo** | Por debajo de este número se considera que el stock es bajo. El crítico siempre debe ser menor que este. Valor mínimo configurado: 1. |
| **Stock crítico** | Nivel de emergencia — hay muy pocas unidades disponibles. Siempre menor que el mínimo. Cuando se llega a este nivel, el sistema envía una alerta por correo al administrador. |

---

## Tipos de baja por daño

| Motivo | Cuándo se usa |
|---|---|
| Dañado | Producto roto o deteriorado físicamente |
| Vencido | Producto que superó su fecha de vencimiento |
| Defectuoso | Falla de fábrica o desperfecto sin daño físico visible |
| Contaminado | Producto que no puede venderse por contaminación |
| Perdido | Faltante sin causa identificada |
| Error de inventario | Diferencia entre el stock del sistema y el conteo físico real |
| Otro | Cualquier causa que no entre en las anteriores |

---

## Reglas importantes

- **No se puede vender más de lo disponible.** El sistema bloquea cualquier pedido que supere el stock disponible, incluyendo lo ya reservado por otras órdenes en curso.
- **La reserva no es el descuento.** Cuando se confirma un pedido, el stock se reserva pero no se descuenta hasta que el administrador lo despacha.
- **Si se cancela un pedido, las unidades vuelven a estar disponibles** automáticamente — no es necesario hacer ningún ajuste manual.
- **Un producto puede estar en varias ubicaciones.** El sistema gestiona cada combinación de producto + ubicación por separado.
- **No se puede eliminar una ubicación si tiene productos asignados.** Primero hay que reasignar o dar de baja el stock de esa ubicación antes de poder eliminarla.
- **Cada movimiento queda registrado para siempre** — no se puede borrar el historial. Esto permite auditar cualquier cambio.
- **Una baja por daño siempre necesita un motivo.** El sistema no acepta bajas sin clasificación.
- **Los niveles de alerta no bloquean automáticamente la venta**, son referencia para que el administrador tome acción. Cuando el stock baja del nivel crítico, el sistema envía una alerta por correo automáticamente.

---

## Ejemplos del día a día

> El administrador recibe un envío de 150 notebooks. Entra al sistema, busca el producto "Notebook X1" en "Depósito Central" y carga la entrada de 150 unidades. El stock sube inmediatamente y queda registrado el movimiento con fecha y hora.

---

> Una cliente compra 2 notebooks online. El sistema reserva 2 unidades automáticamente. Cuando el administrador despacha el pedido, el sistema descuenta esas 2 unidades del stock físico y cierra la reserva.

---

> Durante el control de inventario mensual, el administrador encuentra 5 notebooks con pantalla rota. Registra una baja por daño, indica motivo "Dañado", escribe una descripción y adjunta fotos. Las 5 unidades se descuentan del stock y quedan registradas con toda la evidencia.

---

> El administrador quiere cerrar una sucursal. Antes de eliminarla del sistema, el sistema le avisa que todavía tiene productos asignados. Primero tiene que transferir o dar de baja ese stock, y recién después puede eliminar la ubicación.

---

> El administrador quiere revisar qué pasó con el stock de un producto el mes pasado. Entra al historial de movimientos y ve todas las entradas, salidas y ajustes con fecha, cantidad y origen (si fue por un pedido o manual).

---

## ¿Cómo se conecta con el resto del sistema?

El módulo de stocks trabaja en conjunto con el módulo de productos (para saber de qué producto se trata), con el módulo de órdenes (que le indica cuándo reservar, despachar o liberar stock) y con la tienda online (que consulta la disponibilidad en tiempo real para mostrársela al cliente). Cuando un cliente ve "En stock" en la tienda, es este módulo el que responde. Además, cuando el stock de un producto baja del nivel crítico configurado, el sistema envía automáticamente un correo de alerta al administrador principal.
