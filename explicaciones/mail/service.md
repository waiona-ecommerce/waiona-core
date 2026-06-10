## MailService — el productor de la cola

`MailService` no envía emails. Solo agrega jobs a la cola de Redis. El envío real ocurre en `MailProcessor`.

Esta separación es la clave del sistema: el código que llama a `sendActivationEmail` termina en ~1ms (escribir en Redis), sin importar si Resend está lento o caído.

---

## Infraestructura: cómo BullMQ se conecta a Redis

La conexión Redis se configura una sola vez en `app.module.ts`, globalmente:

```ts
// app.module.ts
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: {
      host: config.get('REDIS_HOST'),
      port: config.get<number>('REDIS_PORT'),
    },
  }),
}),
```

Después, cada módulo que necesita una cola solo declara su nombre. BullMQ reutiliza
la conexión global — no hace falta repetir host/port:

```ts
// mail.module.ts
@Module({
  imports: [BullModule.registerQueue({ name: MAIL_QUEUE })],
  // MAIL_QUEUE = 'mail' — BullMQ crea las keys bull:mail:waiting,
  // bull:mail:active, bull:mail:completed, bull:mail:failed en Redis.
  providers: [MailService, MailProcessor],
  exports: [MailService],
  // Solo MailService se exporta — MailProcessor es interno, no lo necesitan otros módulos.
})
export class MailModule {}
```

---

## Constantes y tipos de la cola

```ts
// mail.constants.ts

export const MAIL_QUEUE = 'mail';

export enum MailJobType {
  SEND_ACTIVATION       = 'send-activation',
  SEND_PASSWORD_RESET   = 'send-password-reset',
  SEND_ORDER_CONFIRMED  = 'send-order-confirmed',
  SEND_ORDER_DISPATCHED = 'send-order-dispatched',
  SEND_ORDER_CANCELLED  = 'send-order-cancelled',
  SEND_ORDER_DELIVERED  = 'send-order-delivered',
  SEND_STOCK_ALERT      = 'send-stock-alert',
}

// Cada tipo de job tiene su propia interface.
// Sirven como contrato entre el productor (MailService) y el consumidor (MailProcessor).
// Si cambiás los datos que necesita un job, TypeScript te avisa en ambos lados.

export interface ActivationJobData {
  to: string;
  name: string;
  activationUrl: string;
}

export interface PasswordResetJobData {
  to: string;
  name: string;
  resetUrl: string;
}

export interface OrderEmailJobData {
  to: string;
  name: string;
  orderId: number;
  orderUrl: string;
}

export interface OrderCancelledJobData {
  to: string;
  name: string;
  orderId: number;
  // Sin orderUrl — en un email de cancelación no tiene sentido llevar al cliente
  // a ver el pedido cancelado.
}

export interface StockAlertJobData {
  productName: string;
  locationName: string;
  quantityAvailable: number;
  threshold: number;
  adminEmail: string;
  // Este job va a un admin, no a un cliente — por eso tiene adminEmail
  // en lugar de depender del usuario autenticado.
}
```

---

## MailService — el productor

```ts
@Injectable()
export class MailService {
  private readonly mailQueue: Queue;
  private readonly frontendUrl: string;

  constructor(
    @InjectQueue(MAIL_QUEUE) mailQueue: object,
    // @InjectQueue inyecta la instancia de la cola registrada con ese nombre.
    // El cast a `object` es porque @nestjs/bull tiene un typing incompleto
    // en algunas versiones — se castea a Queue a continuación.
    private readonly configService: ConfigService<Env>,
  ) {
    this.mailQueue = mailQueue as Queue;
    this.frontendUrl = this.configService.get('FRONTEND_URL', { infer: true })!;
    // FRONTEND_URL se necesita para construir los links de los emails.
    // Se lee en el constructor para no llamar a configService en cada método.
  }

  // MAIL_JOB_OPTIONS se define fuera de la clase — es una constante de módulo,
  // no una propiedad de instancia. Aplica a todos los jobs por igual.
  // attempts: 3 + backoff exponencial significa:
  //   intento 1 falla → espera 2s → intento 2 falla → espera 4s → intento 3
  // Si los 3 fallan, el job queda en bull:mail:failed (visible en Bull Board).
  const MAIL_JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  };

  async sendActivationEmail(to: string, name: string, token: string): Promise<void> {
    // El service construye la URL aquí, no en AuthService.
    // AuthService solo conoce el token — es MailService quien sabe cómo
    // construir un link de activación.
    const activationUrl = `${this.frontendUrl}/auth/activate?token=${token}`;

    await this.mailQueue.add(
      MailJobType.SEND_ACTIVATION,          // tipo del job — el Processor lo enruta al método correcto
      { to, name, activationUrl } satisfies ActivationJobData,
      // `satisfies` verifica en tiempo de compilación que el objeto cumple la interface.
      // Es diferente a un cast (as): no silencia errores, los detecta.
      MAIL_JOB_OPTIONS,
    );
    // add() devuelve el job creado pero no se necesita — el caller no espera confirmación.
    // El await es solo para capturar errores de escritura en Redis (muy raros).
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${token}`;
    await this.mailQueue.add(
      MailJobType.SEND_PASSWORD_RESET,
      { to, name, resetUrl } satisfies PasswordResetJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderConfirmedEmail(to: string, name: string, orderId: number): Promise<void> {
    const orderUrl = `${this.frontendUrl}/orders/${orderId}`;
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_CONFIRMED,
      { to, name, orderId, orderUrl } satisfies OrderEmailJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderDispatchedEmail(to: string, name: string, orderId: number): Promise<void> {
    const orderUrl = `${this.frontendUrl}/orders/${orderId}`;
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_DISPATCHED,
      { to, name, orderId, orderUrl } satisfies OrderEmailJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderCancelledEmail(to: string, name: string, orderId: number): Promise<void> {
    // Sin orderUrl — la cancelación no necesita link de seguimiento.
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_CANCELLED,
      { to, name, orderId } satisfies OrderCancelledJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderDeliveredEmail(to: string, name: string, orderId: number): Promise<void> {
    // URL de review, no de seguimiento — el pedido ya fue entregado,
    // el siguiente paso lógico es dejar una reseña.
    const orderUrl = `${this.frontendUrl}/orders/${orderId}/review`;
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_DELIVERED,
      { to, name, orderId, orderUrl } satisfies OrderEmailJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendStockAlertEmail(data: StockAlertJobData): Promise<void> {
    // Este método recibe el objeto completo en lugar de parámetros sueltos
    // porque StockAlertJobData tiene más campos que los otros jobs.
    // No construye ninguna URL — el alert es solo texto plano.
    await this.mailQueue.add(
      MailJobType.SEND_STOCK_ALERT,
      data,
      MAIL_JOB_OPTIONS,
    );
  }
}
```

---

## Quién llama a MailService y cuándo

| Método | Llamado desde | Cuándo |
|---|---|---|
| `sendActivationEmail` | `AuthService.register()` | Al crear un usuario nuevo |
| `sendPasswordResetEmail` | `AuthService.forgotPassword()` | Al solicitar reset de contraseña |
| `sendOrderConfirmedEmail` | `PaymentsService` (webhook MP) | Pago aprobado por MercadoPago |
| `sendOrderDispatchedEmail` | `OrdersService.updateStatus()` | Admin pasa la orden a DISPATCHED |
| `sendOrderCancelledEmail` | `OrdersService` / `PaymentsService` | Orden cancelada (admin o pago rechazado) |
| `sendOrderDeliveredEmail` | `OrdersService.updateStatus()` | Admin pasa la orden a DELIVERED |
| `sendStockAlertEmail` | `StockItemsService` | Stock baja del umbral crítico al despachar |
