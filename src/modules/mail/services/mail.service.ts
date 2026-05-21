import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import { Env } from 'src/env.model';
import { activationTemplate } from '../templates/activation.template';
import { resetPasswordTemplate } from '../templates/reset-password.template';
import { orderConfirmedTemplate } from '../templates/order-confirmed.template';
import { orderDispatchedTemplate } from '../templates/order-dispatched.template';
import { orderCancelledTemplate } from '../templates/order-cancelled.template';
import { orderDeliveredTemplate } from '../templates/order-delivered.template';

@Injectable()
export class MailService {
  private resend: Resend;
  private from: string;

  constructor(private readonly configService: ConfigService<Env>) {
    this.resend = new Resend(
      this.configService.get('RESEND_API_KEY', { infer: true }),
    );
    this.from =
      this.configService.get('MAIL_FROM', { infer: true }) ??
      'Waiona <onboarding@resend.dev>';
  }

  async sendActivationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', {
      infer: true,
    })!;
    const activationUrl = `${frontendUrl}/auth/activate?token=${token}`;

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Activá tu cuenta en Waiona',
      html: activationTemplate(name, activationUrl),
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', {
      infer: true,
    })!;
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Recuperá tu contraseña en Waiona',
      html: resetPasswordTemplate(name, resetUrl),
    });
  }

  async sendOrderConfirmedEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', {
      infer: true,
    })!;
    const orderUrl = `${frontendUrl}/orders/${orderId}`;

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `Pedido #${orderId} confirmado — Waiona`,
      html: orderConfirmedTemplate(name, orderId, orderUrl),
    });
  }

  async sendOrderDispatchedEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', {
      infer: true,
    })!;
    const orderUrl = `${frontendUrl}/orders/${orderId}`;

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `Tu pedido #${orderId} está en camino — Waiona`,
      html: orderDispatchedTemplate(name, orderId, orderUrl),
    });
  }

  async sendOrderCancelledEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `Pedido #${orderId} cancelado — Waiona`,
      html: orderCancelledTemplate(name, orderId),
    });
  }

  async sendOrderDeliveredEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', {
      infer: true,
    })!;
    const reviewUrl = `${frontendUrl}/orders/${orderId}/review`;

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: `¿Cómo fue tu experiencia con el pedido #${orderId}? — Waiona`,
      html: orderDeliveredTemplate(name, orderId, reviewUrl),
    });
  }
}
