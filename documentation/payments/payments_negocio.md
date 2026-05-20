# Módulo de Pagos — Guía para el Negocio

## ¿Qué es el módulo de pagos?

El módulo de pagos es la parte del sistema que conecta a los clientes con MercadoPago para cobrar los pedidos. Cuando un cliente confirma su pedido y quiere abonarlo, el sistema genera un enlace de pago de MercadoPago. El cliente hace clic en ese enlace, completa el pago en el sitio de MercadoPago, y el sistema actualiza el pedido automáticamente según el resultado.

Por ejemplo: María hace un pedido de $4.950. El sistema le envía un enlace a MercadoPago. Ella paga con tarjeta. Unos segundos después, el pedido de María queda confirmado automáticamente — sin que ningún empleado tenga que hacer nada.

---

## ¿Cómo funciona el proceso de pago?

```
1. Cliente hace un pedido → queda en estado "Pendiente"
        ↓
2. Cliente inicia el pago → el sistema genera un enlace a MercadoPago
        ↓
3. Cliente completa el pago en MercadoPago
        ↓
4. MercadoPago avisa al sistema del resultado
        ↓
5a. Pago aprobado  → pedido pasa a "Confirmado" automáticamente
5b. Pago rechazado → pedido se cancela, el stock reservado queda libre
5c. Pago pendiente → el sistema espera otra notificación de MercadoPago
```

Todo el proceso es automático. El negocio no necesita intervenir para confirmar o rechazar el pedido cuando el pago se procesa correctamente.

---

## ¿Para qué sirve este módulo?

- Permite cobrar pedidos de forma online sin intervención manual.
- Registra un historial completo de cada intento de pago (éxito, rechazo, contracargo).
- Actualiza el estado del pedido y el stock de forma automática según el resultado del pago.
- Protege el negocio ante contracargos o reversiones — si MercadoPago revierte un pago, el pedido se cancela y el stock se libera automáticamente.

---

## Cuándo se usa en el negocio

| Situación | Ejemplo |
|---|---|
| Cliente quiere abonar un pedido online | El sistema genera un link de MercadoPago y el cliente paga con tarjeta, transferencia o billetera virtual |
| MercadoPago confirma el pago | El pedido pasa a "Confirmado" sin que nadie tenga que aprobarlo manualmente |
| El cliente abandona el proceso de pago | El pago queda como "Rechazado" y el pedido se cancela |
| Un cliente hace un contracargo (chargeback) | MercadoPago avisa al sistema, el pago se anula, el pedido se cancela |
| El administrador quiere ver si un pedido fue cobrado | Puede consultar el historial de pagos de ese pedido |

---

## ¿Qué información guarda el sistema de cada pago?

Por cada intento de pago, el sistema guarda:

- **A qué pedido corresponde** — cada pago está vinculado a un pedido específico.
- **Proveedor de pago** — actualmente solo MercadoPago.
- **Estado del pago** — si está pendiente, aprobado, rechazado o cancelado.
- **Monto cobrado** — el total exacto del pedido en el momento del pago.
- **Referencia de MercadoPago** — el código interno que MercadoPago usa para identificar la transacción.
- **Enlace de pago** — la URL de checkout generada para el cliente.

---

## Estados de un pago

| Estado | Qué significa |
|---|---|
| Pendiente | El cliente inició el proceso pero aún no completó el pago en MercadoPago |
| Aprobado | MercadoPago confirmó que el pago se realizó correctamente |
| Rechazado | MercadoPago rechazó o el tiempo de pago expiró |
| Cancelado | El pago fue revertido o se recibió un contracargo |

---

## ¿Qué puede hacer un administrador?

| Acción | Descripción |
|---|---|
| Ver los pagos de un pedido | Consultar el historial completo de intentos de pago de cualquier orden |
| Ver el detalle de un pago | Ver el estado, el monto y la referencia de MercadoPago de un pago específico |

> El administrador **no puede crear ni modificar pagos manualmente** — los pagos solo los genera el cliente y los actualiza MercadoPago.

Los clientes pueden consultar los pagos de sus propios pedidos, pero no los de otros clientes.

---

## Reglas importantes

- **Solo se puede pagar un pedido que esté en estado "Pendiente"** — si el pedido ya fue confirmado, cancelado o está en otro estado, no se puede iniciar un pago.
- **No puede haber dos pagos activos para el mismo pedido al mismo tiempo** — si un cliente intenta pagar dos veces el mismo pedido a la vez, el sistema rechaza el segundo intento.
- **Si el pago falla o expira, el pedido se cancela y el stock se libera** — el sistema deja los productos disponibles para otros clientes automáticamente.
- **Si MercadoPago notifica un resultado, siempre se procesa** — el sistema confirma la recepción incluso si hubo un problema interno, para que MercadoPago no reintente infinitamente.
- **Los contracargos se procesan automáticamente** — si un cliente reclama un contracargo a su banco, el pedido se cancela sin necesidad de intervención manual.

---

## Ejemplos del día a día

> **Caso 1 — Pago exitoso**
> Juan hace un pedido de $6.200. El sistema le genera un link de MercadoPago. Juan paga con su tarjeta de crédito en 3 cuotas. Minutos después, el pedido de Juan aparece como "Confirmado" en el sistema y el equipo puede prepararlo para envío.

> **Caso 2 — Cliente no completa el pago**
> Ana hace un pedido y empieza el proceso de pago, pero cierra la página sin completarlo. Después de un tiempo, MercadoPago notifica que el pago expiró. El sistema cancela el pedido de Ana automáticamente y el stock de los productos vuelve a estar disponible.

> **Caso 3 — Contracargo**
> Carlos abona su pedido, que queda confirmado. Días después, Carlos disputa el cargo con su banco. MercadoPago recibe el contracargo y notifica al sistema. El pedido de Carlos pasa a "Cancelado" automáticamente. El administrador recibe este cambio en el sistema y puede gestionarlo con MercadoPago directamente.

> **Caso 4 — Administrador revisa pagos de un pedido**
> El equipo de atención al cliente recibe un reclamo de un cliente que dice haber pagado pero su pedido sigue en "Pendiente". El administrador consulta el historial de pagos de ese pedido y ve que el pago figura como "Pendiente" — posiblemente la notificación de MercadoPago aún no llegó. Puede consultar directamente en el panel de MercadoPago con la referencia que muestra el sistema.

---

## ¿Cómo se conecta con el resto del sistema?

El módulo de pagos trabaja en estrecha relación con el módulo de pedidos. Cuando un pago es aprobado, el pedido pasa automáticamente a "Confirmado". Cuando un pago falla o es cancelado, el pedido se cancela y el stock reservado se libera para que otros clientes puedan comprarlo.

El módulo de pagos es el último paso del flujo de compra: el cliente navega la tienda → agrega productos → crea el pedido → paga. Una vez que el pago es confirmado, el equipo puede preparar y despachar el pedido.
