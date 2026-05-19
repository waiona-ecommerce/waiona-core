# Orders — Documento de Negocio

## ¿Qué es una orden?

Una orden es el registro de un pedido hecho por un cliente. Cuando un cliente elige productos o combos del menú y confirma su compra, se crea una orden. Esa orden tiene un estado que el equipo administrativo va actualizando a medida que el pedido avanza: se confirma, se prepara, se despacha y finalmente se entrega.

La orden también reserva el stock inmediatamente al crearse, para que dos clientes no pidan el mismo producto al mismo tiempo si solo queda una unidad disponible.

---

## ¿Quién puede hacer qué?

| Acción | Cliente | Administrador |
|---|---|---|
| Crear un pedido | ✅ | — |
| Ver sus propios pedidos | ✅ | — |
| Ver los pedidos de cualquier cliente | ❌ | ✅ |
| Ver todos los pedidos de la plataforma | ❌ | ✅ |
| Avanzar el estado de un pedido | ❌ | ✅ |

El cliente puede ver sus propios pedidos, pero no puede ver los de otros clientes. El administrador tiene visibilidad total.

---

## ¿Cómo se crea un pedido?

El cliente arma su carrito eligiendo productos o combos con su cantidad. Al confirmar:

1. El sistema valida que los productos existen y que hay stock disponible
2. Se calcula el precio de cada item con los descuentos e impuestos vigentes al momento de la compra
3. Si el cliente ingresó un cupón de descuento, se valida y se aplica
4. Se reserva el stock para que nadie más pueda comprarlo mientras el pedido está pendiente
5. Se crea la orden en estado **Pendiente** y se le asigna el precio final (que queda guardado como snapshot — no cambia aunque el precio del producto cambie después)

Si algo falla (stock insuficiente, cupón inválido, producto inexistente), la orden no se crea y el stock no se toca.

---

## Tipos de entrega

| Tipo | Descripción |
|---|---|
| `pickup` | El cliente retira el pedido en el local. No requiere dirección. |
| `delivery` | El pedido se entrega en domicilio. La dirección es obligatoria. |

---

## Estados del pedido y su significado

```
PENDIENTE → CONFIRMADO → DESPACHADO → ENTREGADO
    └───────────────────→ CANCELADO
```

| Estado | ¿Qué significa? | ¿Qué pasa con el stock? |
|---|---|---|
| **Pendiente** | El pedido fue creado. Esperando confirmación del negocio. | Stock reservado |
| **Confirmado** | El negocio aceptó el pedido. En preparación. | Stock sigue reservado |
| **Despachado** | El pedido salió del local. En camino al cliente. | Stock descontado definitivamente |
| **Entregado** | El cliente recibió el pedido. Estado final. | Sin cambios |
| **Cancelado** | El pedido fue cancelado (por el negocio). Estado final. | Reserva liberada |

> Las transiciones son en una sola dirección. Un pedido entregado o cancelado no puede volver atrás.

---

## ¿Qué pasa con el stock en cada momento?

**Al crear el pedido (Pendiente):**  
Se reserva el stock necesario. El producto sigue en el inventario pero aparece como "reservado", no disponible para otros clientes.

**Al despachar el pedido (Despachado):**  
El stock se descuenta definitivamente del inventario. Aquí se registra el movimiento de salida.

**Al cancelar el pedido (Cancelado):**  
La reserva se libera. El stock vuelve a estar disponible para otros clientes como si el pedido nunca hubiera existido.

---

## ¿Cómo funcionan los cupones?

Si el cliente ingresa un código de cupón al crear el pedido:

1. Se verifica que el cupón existe, está activo (dentro de las fechas vigentes) y no alcanzó su límite de usos
2. Se verifica que el cliente no usó ese cupón antes
3. Se calcula el descuento (porcentaje o monto fijo) sobre los productos/combos a los que aplica el cupón
4. El descuento se refleja en el campo "Descuento por cupón" de la orden y se resta del total

Si se cancela un pedido con cupón:
- El contador de usos del cupón se decrementa (el cupo se devuelve al pool)
- El registro de uso del cupón del cliente se borra (puede volver a usar el cupón en una compra futura)

---

## ¿Cómo se calcula el total de una orden?

```
Subtotal = suma de (precio unitario × cantidad) de cada item
Total    = Subtotal − Descuento por cupón
```

Los precios de los items se guardan en la orden en el momento de la compra. Si el administrador cambia el precio de un producto después, las órdenes anteriores no se ven afectadas.

---

## Protección contra abuso

Para evitar que alguien sature el sistema creando muchos pedidos seguidos, el sistema limita la creación de órdenes a **5 pedidos por minuto** por usuario.

---

## Escenarios de uso habituales

### El cliente hace un pedido con pickup

1. Elige 2 milanesas y 1 combo familiar
2. Ingresa el cupón "PROMO10"
3. El sistema calcula el total con el descuento del 10%
4. La orden se crea en estado Pendiente y el stock queda reservado
5. El administrador confirma el pedido (Confirmado)
6. El pedido se prepara y sale del local (Despachado) — el stock se descuenta
7. El cliente retira y el administrador marca como Entregado

### El cliente hace un pedido con delivery

Igual al anterior, pero incluye una dirección de entrega. Sin dirección, el sistema rechaza el pedido.

### El administrador cancela un pedido

El administrador cambia el estado a Cancelado desde Pendiente o Confirmado. El sistema libera el stock reservado automáticamente.

### Dos clientes intentan comprar el último stock al mismo tiempo

El sistema maneja esta situación con bloqueos de base de datos. Solo uno de los dos pedidos logra reservar el stock; el otro recibe un error de stock insuficiente y la orden no se crea.

### El cliente usa un cupón que ya usó antes

El sistema detecta que ese cliente ya usó el cupón en un pedido anterior y rechaza el pedido con un error. El cupón no se aplica dos veces al mismo usuario.
