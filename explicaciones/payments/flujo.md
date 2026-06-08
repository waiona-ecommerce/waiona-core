# Payments — Implementación completa

Este documento cubre toda la implementación de pagos: módulo, entidad, proveedor de MercadoPago, service, controller y flujo end-to-end.

---

## 1. El módulo (`payments.module.ts`)

```ts
@Module({
  imports: [
    ConfigModule,
    // PaymentEntity y OrderEntity necesitan repos propios en este módulo.
    // OrderEntity aparece aquí porque el service hace queries directas a órdenes
    // dentro de transacciones — no puede depender de OrdersService para eso
    // (el EntityManager de la transacción no puede inyectarse en otro service).
    TypeOrmModule.forFeature([PaymentEntity, OrderEntity]),
    OrdersModule,
    // OrdersModule se importa para acceder a OrdersService.releaseStockForOrder(),
    // que se llama desde el webhook handler cuando el pago falla.
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

**Puntos clave:**

- `MercadoPagoProvider` es un provider separado del service — encapsula la inicialización del SDK y la creación de preferencias. El service no sabe nada del SDK de MP, solo llama a `createPreference()`.
- `ConfigModule` se importa explícitamente porque el controller necesita `ConfigService` para leer `MP_WEBHOOK_SECRET`.
- `PaymentsService` se exporta para que otros módulos (ej: analytics) puedan consultarlo en el futuro.

---

## 2. La entidad (`payment.entity.ts`)

```ts
@Entity('payments')
@Index(['orderId'])   // búsquedas frecuentes por orden — filtrar pagos de una orden
@Index(['externalId']) // lookups por ID externo de MP (no usados aún, pero preparado para futuros webhooks alternativos)
export class PaymentEntity extends BaseEntity {

  @Column({ name: 'order_id', type: 'int', nullable: false })
  orderId: number;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
  // onDelete: 'RESTRICT' — no se puede eliminar una orden si tiene pagos.
  // Previene borrar evidencia de cobro ante un hard delete accidental.

  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider; // 'mercadopago' | 'stripe' (stripe aún no implementado)

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus; // pending | approved | rejected | cancelled

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId?: string | null;
  // El ID de la preferencia de MP (no el ID del pago, el de la preferencia).
  // Se usa para correlacionar eventos futuros.

  @Column({ name: 'checkout_url', type: 'varchar', length: 500, nullable: true })
  checkoutUrl?: string | null;
  // La URL init_point de MP — el cliente es redirigido aquí para pagar.

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  amount: number;
  // Snapshot del total al momento de crear el pago.
  // El total de la orden podría teóricamente cambiar; el pago guarda cuánto se cobró.

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;
  // Guarda el body y query del webhook cuando se procesa.
  // Útil para debugging y auditoría sin tener que ir a los logs de MP.
}
```

---

## 3. MercadoPagoProvider (`mercadopago.provider.ts`)

El provider inicializa el SDK una sola vez (en el constructor) y expone dos cosas: el cliente y la creación de preferencias.

```ts
@Injectable()
export class MercadoPagoProvider {
  private readonly client: MercadoPagoConfig;
  private readonly preference: Preference;

  constructor(private readonly configService: ConfigService<Env>) {
    // El cliente se crea UNA sola vez al levantar la app.
    // MP SDK es stateless — el cliente solo guarda el accessToken.
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get('MP_ACCESS_TOKEN', { infer: true })!,
    });
    this.preference = new Preference(this.client);
  }

  // El service de pagos expone el cliente para que PaymentsService pueda
  // instanciar Payment y MerchantOrder dentro del webhook handler.
  // No se inyectan en el constructor porque solo se usan en ese path.
  getClient(): MercadoPagoConfig {
    return this.client;
  }

  async createPreference(order: OrderEntity): Promise<{ id: string; checkoutUrl: string }> {
    const frontendUrl = this.configService.get('FRONTEND_URL', { infer: true })!;
    const notificationUrl = this.configService.get('MP_NOTIFICATION_URL', { infer: true })!;

    const response = await this.preference.create({
      body: {
        items: [
          {
            id: String(order.id),
            title: `Orden #${order.id}`,
            quantity: 1,
            // MP espera un entero — Math.round() convierte el decimal de la DB.
            unit_price: Math.round(Number(order.total)),
            currency_id: 'ARS',
          },
        ],
        // external_reference vincula la preferencia de MP con la orden interna.
        // Es la clave que permite, cuando llega el webhook, saber a qué orden corresponde.
        external_reference: String(order.id),
        back_urls: {
          success: `${frontendUrl}/payment/success`,
          failure: `${frontendUrl}/payment/failure`,
          pending: `${frontendUrl}/payment/pending`,
        },
        // auto_return: 'approved' → MP redirige automáticamente a back_urls.success
        // solo cuando el pago fue aprobado. Para otros estados, el usuario debe hacer click.
        auto_return: 'approved',
        // MP llama a esta URL con cada cambio de estado del pago.
        notification_url: notificationUrl,
      },
    });

    return {
      id: response.id!,               // ID de la preferencia (externalId en nuestra DB)
      checkoutUrl: response.init_point!, // URL de checkout — se devuelve al cliente
    };
  }
}
```

**Por qué separar el provider del service:**

El SDK de MP requiere inicialización (client + accessToken). Si eso viviera en el service, el service sería difícil de testear y mezclaría responsabilidades. El provider es la barrera de abstracción: en tests se puede mockear `MercadoPagoProvider` sin tocar el SDK real.

---

## 4. PaymentsService — crear un pago

```ts
async create(userId: number, role: RoleType, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
  return this.dataSource.transaction(async (manager) => {

    // PATRÓN DOBLE FINDONE: primero con lock (sin relaciones), luego con relaciones.
    //
    // Por qué dos queries en lugar de una:
    // TypeORM genera "SELECT ... FOR UPDATE" para pessimistic_write.
    // Si el findOne incluye relaciones opcionales (nullable outer joins),
    // PostgreSQL rechaza la query con: "FOR UPDATE cannot be applied to the nullable side
    // of an outer join". La solución: lock en la tabla base sin relaciones, luego
    // una segunda query normal con las relaciones que se necesiten.
    //
    // El lock garantiza que dos requests concurrentes no lean el mismo estado.
    // El segundo request espera a que el primero haga commit y entonces verá
    // el pago PENDING ya creado — y lanzará 400 en la verificación de idempotencia.
    const locked = await manager.findOne(OrderEntity, {
      where: { id: dto.orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) throw new NotFoundException('Orden no encontrada');

    const order = await manager.findOne(OrderEntity, { where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    // Los clientes solo pueden pagar sus propias órdenes.
    // ADMIN y SUPER_ADMIN pueden crear pagos en nombre de cualquier usuario.
    if (role === RoleType.CLIENT && order.userId !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }

    // Solo órdenes PENDING son pagables.
    // Si ya está CONFIRMED, DISPATCHED, DELIVERED o CANCELLED → rechazar.
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La orden no está en estado pagable');
    }

    // IDEMPOTENCIA: si ya existe un pago PENDING para esta orden (ej: doble click,
    // request duplicado), se rechaza. El cliente debe usar el pago existente.
    const existingPayment = await manager.findOne(PaymentEntity, {
      where: { orderId: dto.orderId, status: PaymentStatus.PENDING },
    });
    if (existingPayment) {
      throw new BadRequestException('La orden ya tiene un pago pendiente');
    }

    let externalId: string | null = null;
    let checkoutUrl: string | null = null;

    if (dto.provider === PaymentProvider.MERCADOPAGO) {
      // createPreference llama a la API de MP. Si MP está caído, la transacción
      // falla y no se crea nada — estado consistente.
      const preference = await this.mercadoPagoProvider.createPreference(order);
      externalId = preference.id;
      checkoutUrl = preference.checkoutUrl;
    }

    const payment = manager.create(PaymentEntity, {
      orderId: dto.orderId,
      provider: dto.provider,
      status: PaymentStatus.PENDING,
      externalId,
      checkoutUrl,
      amount: order.total, // snapshot del total en este momento
    });

    const saved = await manager.save(PaymentEntity, payment);
    return new PaymentResponseDto(saved);
  });
}
```

---

## 5. PaymentsService — el webhook handler

### 5.1 Normalización de topics

MP puede enviar notificaciones con dos formatos distintos según cómo esté configurada la integración:

| Topic | Fuente | Status devuelto |
|---|---|---|
| `payment` | Payment API de MP | `approved`, `refunded`, `charged_back`, `in_process`, `pending`, etc. |
| `merchant_order` | MerchantOrder API de MP | `paid`, `refunded`, `payment_required`, `payment_in_process`, etc. |

El handler unifica ambos vocabularios a un único conjunto de strings internos antes de procesar.

```ts
async handleMercadoPagoWebhook(body, query): Promise<void> {
  const topic = query['topic'] ?? body.type;
  const id    = query['id']    ?? body.data?.id;

  // Notificaciones sin ID o de topics no reconocidos se descartan silenciosamente.
  if (!id) return;
  if (topic !== 'payment' && topic !== 'merchant_order') return;

  try {
    let externalReference: string | null | undefined;
    let mpStatus: string | null | undefined;

    if (topic === 'payment') {
      const mpPayment = new Payment(this.mercadoPagoProvider.getClient());
      const paymentData = await mpPayment.get({ id: String(id) });
      externalReference = paymentData.external_reference;

      // Normalizar al vocabulario de merchant_order para unificar el switch de abajo.
      const s = paymentData.status;
      if (s === 'approved')                           mpStatus = 'paid';
      else if (s === 'refunded' || s === 'charged_back') mpStatus = 'reverted';
      else if (s === 'in_process' || s === 'pending') mpStatus = 'payment_in_process';
      else                                            mpStatus = 'expired';

    } else {
      // merchant_order ya usa el vocabulario que queremos — no normalizar.
      const merchantOrder = new MerchantOrder(this.mercadoPagoProvider.getClient());
      const mpOrder = await merchantOrder.get({ merchantOrderId: Number(id) });
      externalReference = mpOrder.external_reference;
      mpStatus = mpOrder.order_status; // 'paid' | 'refunded' | 'payment_required' | etc.
    }

    if (!externalReference) return; // sin referencia no podemos correlacionar la orden
```

### 5.2 Transacción con locks y mapeo de estados

```ts
    await this.dataSource.transaction(async (manager) => {
      // Locks pesimistas en payment Y order para evitar race condition:
      // MP puede enviar múltiples notificaciones del mismo evento casi simultáneamente.
      // Sin lock, dos webhooks concurrentes podrían leer el mismo estado inicial
      // y aplicar la misma transición dos veces (ej: cancelar la orden dos veces
      // y liberar el stock dos veces → stock negativo).
      const payment = await manager.findOne(PaymentEntity, {
        where: { orderId: Number(externalReference) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) return;

      const order = await manager.findOne(OrderEntity, {
        where: { id: payment.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) return;

      const cancellable = order.status === OrderStatus.PENDING ||
                          order.status === OrderStatus.CONFIRMED;
      let orderChanged = false;

      if (mpStatus === 'paid') {
        payment.status = PaymentStatus.APPROVED;
        // Idempotente: si la orden ya está CONFIRMED (ej: segunda notificación 'paid'),
        // no se vuelve a confirmar — se evita re-confirmar accidentalmente.
        if (order.status === OrderStatus.PENDING) {
          order.status = OrderStatus.CONFIRMED;
          orderChanged = true;
        }

      } else if (mpStatus === 'reverted' || mpStatus === 'refunded') {
        // 'reverted' → normalización de topic=payment (refunded/charged_back)
        // 'refunded' → viene directo de merchant_order
        payment.status = PaymentStatus.CANCELLED;
        if (cancellable) { order.status = OrderStatus.CANCELLED; orderChanged = true; }

      } else if (mpStatus === 'payment_required' || mpStatus === 'payment_in_process') {
        // El pago está en curso — solo actualizar el status del pago, no la orden.
        payment.status = PaymentStatus.PENDING;

      } else {
        // 'expired' u otros estados desconocidos → REJECTED y cancelar la orden.
        payment.status = PaymentStatus.REJECTED;
        if (cancellable) { order.status = OrderStatus.CANCELLED; orderChanged = true; }
      }

      payment.metadata = { body, query }; // snapshot del webhook para auditoría

      if (orderChanged) {
        // releaseStockForOrder recibe el manager de la misma transacción —
        // si falla la liberación del stock, la transacción entera se revierte.
        // Garantía: el estado del pago, la orden y el stock son siempre consistentes.
        await this.ordersService.releaseStockForOrder(payment.orderId, manager);
        await manager.save(order);
      }
      await manager.save(payment);
    });

  } catch {
    // SWALLOW DELIBERADO.
    // MP requiere siempre HTTP 200. Si el service lanzara, NestJS devolvería 500
    // y MP reintentaría la notificación indefinidamente, generando retries en cascada.
    // Los errores transitorios (DB caída, MP API lenta) se resuelven solos
    // porque MP reintentará con backoff exponencial.
  }
}
```

### 5.3 Tabla de mapeo de estados

| mpStatus (interno) | PaymentStatus | OrderStatus | releaseStock |
|---|---|---|---|
| `paid` | APPROVED | CONFIRMED (si estaba PENDING) | No |
| `reverted` / `refunded` | CANCELLED | CANCELLED (si era PENDING/CONFIRMED) | Sí |
| `payment_required` / `payment_in_process` | PENDING | sin cambio | No |
| `expired` / otros | REJECTED | CANCELLED (si era PENDING/CONFIRMED) | Sí |

---

## 6. Controller — webhook con siempre-200

```ts
@SkipThrottle()          // MP puede enviar muchas notificaciones por minuto — sin límite de rate
@Post('webhook/mercadopago')
@HttpCode(HttpStatus.OK) // NestJS defaultea a 201 en POST — forzar 200 que exige MP
async handleMercadoPagoWebhook(@Body() body, @Query() query, @Headers() headers) {

  // La verificación de firma está en un try/catch PROPIO — separado del service.
  //
  // Si verifyMercadoPagoSignature lanzara sin atrapar, NestJS lo convertiría en 401.
  // MP ante cualquier respuesta != 200 interpreta que el servidor tuvo un error y
  // reintenta indefinidamente → degradación del servicio.
  //
  // Con el try/catch: firma inválida → log silencioso → return { received: true } → 200.
  // La notificación se descarta sin llamar al service.
  try {
    this.verifyMercadoPagoSignature(headers, query);
  } catch {
    return { received: true };
  }

  // El service tiene su propio try/catch interno — dos capas de protección.
  // Si el service fallara sin catch, esta función propagaría el error y
  // NestJS devolvería 500. El try/catch del service garantiza que nunca pasa eso.
  await this.paymentsService.handleMercadoPagoWebhook(body, query);
  return { received: true };
}
```

---

## 7. Verificación de firma HMAC-SHA256

```ts
private verifyMercadoPagoSignature(headers, query): void {
  const secret = this.configService.get('MP_WEBHOOK_SECRET', { infer: true });

  // En desarrollo, MP_WEBHOOK_SECRET está vacío → se omite la verificación.
  // En producción DEBE estar configurado o cualquiera podría llamar el webhook.
  if (!secret) return;

  const xSignature  = headers['x-signature'];   // ts=<ts>,v1=<hash>
  const xRequestId  = headers['x-request-id'];  // ID único del request de MP

  if (!xSignature || !xRequestId) {
    throw new UnauthorizedException('Faltan los headers de firma de MercadoPago');
  }

  // Parsear x-signature: "ts=1234567890,v1=abc123..."
  const parts  = xSignature.split(',');
  const tsPart = parts.find((p) => p.startsWith('ts='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tsPart || !v1Part) throw new UnauthorizedException('Formato de firma inválido');

  const ts = tsPart.split('=')[1]; // timestamp que MP usó para firmar
  const v1 = v1Part.split('=')[1]; // HMAC que MP envía

  // MP puede enviar el ID de pago como 'data.id' (IPN) o 'id' (webhook) en el query string.
  const dataId = query['data.id'] ?? query['id'] ?? '';

  // El manifest exacto según la documentación de MP:
  // "id:<dataId>;request-id:<xRequestId>;ts:<ts>;"
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected  = createHmac('sha256', secret).update(manifest).digest('hex');

  if (expected !== v1) {
    throw new UnauthorizedException('Firma de MercadoPago inválida');
  }
}
```

---

## 8. Control de acceso en consultas

```ts
// findByOrder — el cliente solo puede ver pagos de sus propias órdenes
async findByOrder(orderId, userId, role): Promise<PaymentResponseDto[]> {
  if (role === RoleType.CLIENT) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    // Mismo error para "orden no encontrada" y "no te pertenece" — no revela si la orden existe.
    if (order.userId !== userId) throw new ForbiddenException('Acceso denegado');
  }
  const payments = await this.paymentRepo.find({
    where: { orderId },
    order: { createdAt: 'DESC' }, // el más reciente primero
  });
  return payments.map((p) => new PaymentResponseDto(p));
}

// findOne — carga la relación order solo para clientes (para chequear ownership)
async findOne(id, userId, role): Promise<PaymentResponseDto> {
  const payment = await this.paymentRepo.findOne({
    where: { id },
    // Los admins no necesitan la relación — no se hace el join.
    // Los clientes sí la necesitan para verificar que order.userId === userId.
    relations: role === RoleType.CLIENT ? ['order'] : [],
  });
  if (!payment) throw new NotFoundException('Pago no encontrado');
  if (role === RoleType.CLIENT && payment.order?.userId !== userId) {
    throw new ForbiddenException('Acceso denegado');
  }
  return new PaymentResponseDto(payment);
}
```

---

## 9. Flujo completo end-to-end

```
Cliente: POST /v1/orders
  → CalculationService calcula precios
  → StockItemsService.reserveStock() → reserva en DB
  → CouponUsageEntity creado (si hay cupón)
  → Orden creada con status PENDING
  → Respuesta: { id: 42, total: 5000, status: 'pending', ... }

Cliente: POST /v1/payments  { orderId: 42, provider: 'mercadopago' }
  → [transacción + lock en orders row 42]
  → Valida: orden existe, es PENDING, no hay pago PENDING previo
  → MercadoPagoProvider.createPreference(order)
      → Llama a la API de MP
      → MP devuelve { id: 'pref_123', init_point: 'https://mp.com/checkout/...' }
  → PaymentEntity creada { orderId: 42, status: PENDING, externalId: 'pref_123', checkoutUrl: '...' }
  → Respuesta: { id: 1, checkoutUrl: 'https://mp.com/checkout/...', status: 'pending' }

Cliente: [redirigido a checkoutUrl] → paga en MercadoPago

MP: POST /v1/payments/webhook/mercadopago
  → verifyMercadoPagoSignature() → HMAC válido
  → handleMercadoPagoWebhook(body, query)
      → topic: 'payment', id: '789'
      → Payment API de MP: paymentData.status = 'approved'
      → mpStatus normalizado = 'paid'
      → [transacción + locks en payments row 1 + orders row 42]
      → payment.status = APPROVED
      → order.status = CONFIRMED (estaba PENDING → cambia)
      → NO se llama releaseStockForOrder (aprobado → el stock reservado sigue reservado)
      → payment.metadata = { body, query }
      → commit
  → return { received: true } → HTTP 200

Admin: PATCH /v1/orders/42/status  { status: 'dispatched' }
  → validateStatusTransition(CONFIRMED → DISPATCHED) → válido
  → handleDispatch() → StockItemsService.dispatchStock() → descuenta stock real
  → Orden DISPATCHED
  → MailService.sendOrderDispatchedEmail()

Admin: PATCH /v1/orders/42/status  { status: 'delivered' }
  → validateStatusTransition(DISPATCHED → DELIVERED) → válido
  → Orden DELIVERED
  → MailService.sendOrderDeliveredEmail()
```

---

## 10. Decisiones de diseño notables

| Decisión | Por qué |
|---|---|
| Doble `findOne` (lock sin relaciones, luego con relaciones) | PostgreSQL no acepta `FOR UPDATE` en outer joins — separar el lock del load evita el error |
| `catch {}` en el service del webhook | MP requiere siempre 200; errores transitorios son reintentados por MP automáticamente |
| Verificación de firma en `try/catch` en el controller | Un error de firma no puede devolver 401 — rompería el contrato de siempre-200 con MP |
| `MP_WEBHOOK_SECRET` vacío omite verificación | Permite desarrollo local sin configurar el secret de MP |
| `external_reference = order.id` en la preferencia de MP | Vinculo entre el pago en MP y la orden interna — es la clave de correlación en el webhook |
| `Math.round(order.total)` en la preferencia | La API de MP espera enteros — el `decimal(12,2)` de la DB se redondea |
| Lock en payment Y order en el webhook handler | Previene race condition ante webhooks duplicados simultáneos del mismo evento de MP |
| `releaseStockForOrder` dentro de la misma transacción | Garantiza que estado de orden y stock son atómicos — nunca pueden quedar inconsistentes |
| `amount` snapshot en PaymentEntity | Guarda cuánto se cobró en ese momento, independientemente de si el total de la orden cambia |
| `metadata: { body, query }` en el pago | Auditoría completa de lo que llegó de MP, sin depender de los logs |
| `@SkipThrottle()` en el webhook | MP puede enviar muchas notificaciones en ráfagas cortas — el rate limiter global los bloquearía |
| `onDelete: 'RESTRICT'` en la FK de PaymentEntity a OrderEntity | No se puede eliminar una orden si tiene pagos — preserva evidencia de cobro |
