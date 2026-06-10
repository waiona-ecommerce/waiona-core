## MailProcessor — el consumidor de la cola

`MailProcessor` es la otra mitad del sistema. Escucha la cola de Redis, toma un job,
llama a la API de Resend y marca el job como completado. Si falla, BullMQ lo reintenta
automáticamente según las opciones definidas en `MailService`.

---

## Cómo funciona el enrutamiento de jobs

```ts
@Processor(MAIL_QUEUE)
// @Processor('mail') — registra este class como el consumidor de la cola 'mail'.
// BullMQ busca métodos decorados con @Process dentro de este class.
export class MailProcessor {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService<Env>) {
    // Resend se instancia en el constructor — una sola instancia para toda
    // la vida del processor, no una por email. El SDK de Resend es stateless
    // así que no hay problema en reutilizarlo.
    this.resend = new Resend(
      this.configService.get('RESEND_API_KEY', { infer: true }),
    );

    this.from =
      this.configService.get('MAIL_FROM', { infer: true }) ??
      'Waiona <onboarding@resend.dev>';
    // Fallback a onboarding@resend.dev — el dominio de prueba de Resend.
    // En producción MAIL_FROM debe estar configurado con un dominio verificado.
  }

  @Process(MailJobType.SEND_ACTIVATION)
  // @Process('send-activation') — este método maneja SOLO los jobs de ese tipo.
  // BullMQ enruta automáticamente: job.name === 'send-activation' → sendActivation().
  async sendActivation(job: Job): Promise<void> {
    const { to, name, activationUrl } = job.data as ActivationJobData;
    // job.data es `any` en el tipo de Bull — el cast a ActivationJobData
    // restaura el tipado. Es seguro porque MailService guarantiza la forma
    // del objeto con `satisfies` al encolar.
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Activá tu cuenta en Waiona',
      html: activationTemplate(name, activationUrl),
    });
    // Si resend.emails.send lanza una excepción, @Process la captura,
    // marca el job como fallido y BullMQ programa el reintento según backoff.
    // No hay try/catch aquí — el manejo de reintentos está en los MAIL_JOB_OPTIONS.
  }

  @Process(MailJobType.SEND_PASSWORD_RESET)
  async sendPasswordReset(job: Job): Promise<void> {
    const { to, name, resetUrl } = job.data as PasswordResetJobData;
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Recuperá tu contraseña en Waiona',
      html: resetPasswordTemplate(name, resetUrl),
    });
  }

  @Process(MailJobType.SEND_ORDER_CONFIRMED)
  async sendOrderConfirmed(job: Job): Promise<void> {
    const { to, name, orderId, orderUrl } = job.data as OrderEmailJobData;
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `Pedido #${orderId} confirmado — Waiona`,
      html: orderConfirmedTemplate(name, orderId, orderUrl),
    });
  }

  @Process(MailJobType.SEND_ORDER_DISPATCHED)
  async sendOrderDispatched(job: Job): Promise<void> {
    const { to, name, orderId, orderUrl } = job.data as OrderEmailJobData;
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `Tu pedido #${orderId} está en camino — Waiona`,
      html: orderDispatchedTemplate(name, orderId, orderUrl),
    });
  }

  @Process(MailJobType.SEND_ORDER_CANCELLED)
  async sendOrderCancelled(job: Job): Promise<void> {
    const { to, name, orderId } = job.data as OrderCancelledJobData;
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `Pedido #${orderId} cancelado — Waiona`,
      html: orderCancelledTemplate(name, orderId),
    });
  }

  @Process(MailJobType.SEND_ORDER_DELIVERED)
  async sendOrderDelivered(job: Job): Promise<void> {
    const { to, name, orderId, orderUrl } = job.data as OrderEmailJobData;
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `¿Cómo fue tu experiencia con el pedido #${orderId}? — Waiona`,
      html: orderDeliveredTemplate(name, orderId, orderUrl),
      // El subject invita a dejar una reseña — el link en el email apunta a /orders/:id/review.
    });
  }

  @Process(MailJobType.SEND_STOCK_ALERT)
  async sendStockAlert(job: Job): Promise<void> {
    const { productName, locationName, quantityAvailable, threshold, adminEmail } =
      job.data as StockAlertJobData;
    await this.resend.emails.send({
      from: this.from,
      to: adminEmail,
      // Este es el único job donde `to` no es el cliente sino el admin —
      // viene en el job.data porque el Processor no tiene acceso al contexto
      // de request ni al usuario autenticado.
      subject: `Stock crítico: ${productName}`,
      html: `
        <h2>Alerta de stock crítico</h2>
        <p><strong>Producto:</strong> ${productName}</p>
        <p><strong>Depósito:</strong> ${locationName}</p>
        <p><strong>Stock disponible:</strong> ${quantityAvailable} unidades</p>
        <p><strong>Umbral crítico:</strong> ${threshold} unidades</p>
        <p>Por favor, reabastezca el stock a la brevedad.</p>
      `,
      // HTML inline sin template dedicado — es un alert operacional interno,
      // no un email de cara al cliente. No necesita diseño con EMAIL_THEME.
    });
  }
}
```

---

## Los templates HTML

Cada template es una función pura que recibe datos y devuelve un string HTML.

```ts
// common/theme/email-theme.ts
export const EMAIL_THEME = {
  colors: {
    primary:   '#1C8968',  // verde — header y títulos
    secondary: '#F9C82F',  // amarillo — botones de acción
    accent:    '#F08A27',  // naranja — no usado actualmente
    light:     '#F5F5F5',  // gris claro — fondo y footer
    text:      '#1F2937',  // gris oscuro — texto del body
  },
  logo: `${process.env.API_URL}/email/logo.png`,
  // El logo se sirve desde la propia API. En desarrollo necesitás una URL
  // pública (ej: Cloudinary) porque Resend llama desde sus servidores,
  // no desde tu máquina local. localhost no es accesible desde internet.
};
```

```ts
// templates/activation.template.ts
export function activationTemplate(name: string, url: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.colors.light};font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:12px;overflow:hidden;">

          <!-- HEADER con logo -->
          <tr>
            <td style="background:${EMAIL_THEME.colors.primary};padding:30px;text-align:center;">
              <img src="${EMAIL_THEME.logo}" width="120" style="display:block;margin:auto;" alt="Waiona" />
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px;color:${EMAIL_THEME.colors.primary};">
                Hola ${name}
              </h2>
              <p style="color:${EMAIL_THEME.colors.text};line-height:1.6;margin:0 0 24px;">
                Gracias por registrarte en Waiona. Activá tu cuenta haciendo clic en el botón.
              </p>

              <!-- El botón es un <a> con estilos inline — los clientes de email
                   ignoran stylesheets externos y muchos bloquean <style> en <head>.
                   Inline es el único CSS que funciona universalmente. -->
              <div style="text-align:center;margin:30px 0;">
                <a href="${url}" style="
                    background:${EMAIL_THEME.colors.secondary};
                    padding:14px 28px;
                    text-decoration:none;
                    border-radius:6px;
                    color:#000;
                    font-weight:bold;
                    display:inline-block;
                    letter-spacing:1px;">
                  Activar cuenta
                </a>
              </div>

              <!-- URL de fallback en texto plano por si el botón no carga -->
              <p style="font-size:12px;color:#666;margin:0 0 8px;">
                O copiá este link en tu navegador:
              </p>
              <p style="font-size:11px;color:${EMAIL_THEME.colors.primary};word-break:break-all;margin:0 0 24px;">
                ${url}
              </p>

              <p style="font-size:12px;color:#666;margin:0;">
                Este link expira en <strong>24 horas</strong>.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px;text-align:center;background:${EMAIL_THEME.colors.light};font-size:12px;">
              <p style="margin:0;color:${EMAIL_THEME.colors.text};">
                © ${new Date().getFullYear()} Waiona · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

**Por qué tablas con estilos inline:**
Los clientes de email (Gmail, Outlook, Apple Mail) tienen motores de rendering muy distintos y restricciones. Gmail elimina `<style>` del `<head>` en algunos contextos. Outlook usa Word como motor de rendering HTML. La única forma de garantizar que el email se ve bien en todos es usar tablas anidadas con estilos inline — una técnica antigua pero que sigue siendo el estándar en emails HTML.

---

## Flujo completo de un job, paso a paso

```
1. AuthService.register() llama a MailService.sendActivationEmail(to, name, token)

2. MailService construye activationUrl y llama a mailQueue.add(
     'send-activation',
     { to, name, activationUrl },
     { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
   )
   → BullMQ serializa el job y lo guarda en Redis (bull:mail:waiting)
   → add() retorna en ~1ms
   → AuthService.register() sigue y responde 201 al cliente

3. BullMQ (en background) mueve el job de waiting → active
   → llama a MailProcessor.sendActivation(job)

4. sendActivation() llama a resend.emails.send(...)

   ┌── ÉXITO ──────────────────────────────────────────────────────┐
   │ Resend acepta el email                                        │
   │ BullMQ mueve el job a bull:mail:completed                     │
   │ (por defecto se guardan los últimos 100 completados en Redis) │
   └───────────────────────────────────────────────────────────────┘

   ┌── FALLO ──────────────────────────────────────────────────────┐
   │ Resend lanza excepción (timeout, 5xx, red caída)              │
   │ BullMQ captura el error                                       │
   │ job.attemptsMade = 1 → espera 2s → reintento                 │
   │ job.attemptsMade = 2 → espera 4s → reintento                 │
   │ job.attemptsMade = 3 → job queda en bull:mail:failed          │
   └───────────────────────────────────────────────────────────────┘
```

---

## Jobs por estado en Redis

BullMQ mantiene listas separadas en Redis para cada estado:

| Key en Redis | Descripción |
|---|---|
| `bull:mail:waiting` | Jobs en cola esperando ser procesados |
| `bull:mail:active` | Job siendo procesado ahora |
| `bull:mail:completed` | Procesados exitosamente (últimos N) |
| `bull:mail:failed` | Fallaron todos los reintentos |
| `bull:mail:delayed` | En backoff, esperando el próximo reintento |

Los jobs en `failed` no se pierden — pueden reintentarse manualmente desde Bull Board u otra herramienta de administración.
