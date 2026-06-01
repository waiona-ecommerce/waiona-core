import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import { Env } from '../../../env.model';
import { activationTemplate } from '../templates/activation.template';
import { resetPasswordTemplate } from '../templates/reset-password.template';
import { orderConfirmedTemplate } from '../templates/order-confirmed.template';
import { orderDispatchedTemplate } from '../templates/order-dispatched.template';
import { orderCancelledTemplate } from '../templates/order-cancelled.template';
import { orderDeliveredTemplate } from '../templates/order-delivered.template';
import {
  MAIL_QUEUE,
  MailJobType,
  ActivationJobData,
  PasswordResetJobData,
  OrderEmailJobData,
  OrderCancelledJobData,
  StockAlertJobData,
} from '../mail.constants';

@Processor(MAIL_QUEUE)
export class MailProcessor {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService<Env>) {
    this.resend = new Resend(
      this.configService.get('RESEND_API_KEY', { infer: true }),
    );
    this.from =
      this.configService.get('MAIL_FROM', { infer: true }) ??
      'Waiona <onboarding@resend.dev>';
  }

  @Process(MailJobType.SEND_ACTIVATION)
  async sendActivation(job: Job): Promise<void> {
    const { to, name, activationUrl } = job.data as ActivationJobData;
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Activá tu cuenta en Waiona',
      html: activationTemplate(name, activationUrl),
    });
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
    });
  }

  @Process(MailJobType.SEND_STOCK_ALERT)
  async sendStockAlert(job: Job): Promise<void> {
    const {
      productName,
      locationName,
      quantityAvailable,
      threshold,
      adminEmail,
    } = job.data as StockAlertJobData;
    await this.resend.emails.send({
      from: this.from,
      to: adminEmail,
      subject: `Stock crítico: ${productName}`,
      html: `
        <h2>Alerta de stock crítico</h2>
        <p><strong>Producto:</strong> ${productName}</p>
        <p><strong>Depósito:</strong> ${locationName}</p>
        <p><strong>Stock disponible:</strong> ${quantityAvailable} unidades</p>
        <p><strong>Umbral crítico:</strong> ${threshold} unidades</p>
        <p>Por favor, reabastezca el stock a la brevedad.</p>
      `,
    });
  }
}
