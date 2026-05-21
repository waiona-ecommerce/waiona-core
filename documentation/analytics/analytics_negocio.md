# Analytics — Documento de Negocio

## ¿Qué es el módulo de analytics?

Es la fuente de datos para el panel de control del administrador. Permite ver de un vistazo cómo está el negocio: cuántos pedidos hay, cuánto se facturó, qué productos se venden más, y qué productos están por quedarse sin stock.

Solo los administradores pueden acceder a esta información. Los clientes no tienen acceso.

---

## ¿Qué información provee?

### Resumen de órdenes

Muestra una foto del estado actual de todos los pedidos:

- **Total de órdenes** — cuántos pedidos existen en total
- **Órdenes por estado** — cuántas están pendientes, confirmadas, despachadas, entregadas o canceladas
- **Facturación total** — suma de todos los pedidos que no fueron cancelados
- **Facturación hoy** — lo que se facturó en el día actual
- **Facturación este mes** — lo que se facturó en el mes actual

Las órdenes canceladas no se cuentan en la facturación — una orden cancelada no generó ingreso real.

---

### Top 10 productos más vendidos

Lista los 10 productos que más unidades se vendieron, contando solo los pedidos que llegaron a ser **entregados**.

Un pedido pendiente o cancelado no cuenta — solo lo que efectivamente se entregó al cliente.

Esto permite al administrador:
- Identificar qué productos tienen más demanda
- Decidir qué productos priorizar en stock
- Detectar tendencias de venta

---

### Stock en estado crítico

Lista todos los productos que tienen stock **igual o por debajo de su umbral crítico**. Muestra:

- Nombre del producto y SKU
- Depósito donde está el stock
- Cantidad disponible actual
- Umbral crítico configurado

Esto permite actuar antes de quedarse sin stock. Los productos aparecen ordenados de menor a mayor stock disponible — los más urgentes primero.

> El umbral crítico se configura por cada producto y depósito desde el módulo de stock.

---

## ¿Quién puede ver esta información?

| Acción | Cliente | Administrador |
|---|---|---|
| Ver resumen de órdenes | ❌ | ✅ |
| Ver top productos | ❌ | ✅ |
| Ver stock crítico | ❌ | ✅ |

---

## ¿Con qué frecuencia se actualiza?

Los datos son en tiempo real — cada vez que el administrador consulta el panel, el sistema calcula las métricas al momento. No hay datos cacheados ni reportes pre-generados.
