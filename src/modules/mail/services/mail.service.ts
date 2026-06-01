import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';

import { Env } from '../../../env.model';
import {
  MAIL_QUEUE,
  MailJobType,
  ActivationJobData,
  PasswordResetJobData,
  OrderEmailJobData,
  OrderCancelledJobData,
  StockAlertJobData,
} from '../mail.constants';

const MAIL_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
};

@Injectable()
export class MailService {
  private readonly mailQueue: Queue;
  private readonly frontendUrl: string;

  constructor(
    @InjectQueue(MAIL_QUEUE) mailQueue: object,
    private readonly configService: ConfigService<Env>,
  ) {
    this.mailQueue = mailQueue as Queue;
    this.frontendUrl = this.configService.get('FRONTEND_URL', { infer: true })!;
  }

  async sendActivationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const activationUrl = `${this.frontendUrl}/auth/activate?token=${token}`;
    await this.mailQueue.add(
      MailJobType.SEND_ACTIVATION,
      { to, name, activationUrl } satisfies ActivationJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${token}`;
    await this.mailQueue.add(
      MailJobType.SEND_PASSWORD_RESET,
      { to, name, resetUrl } satisfies PasswordResetJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderConfirmedEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    const orderUrl = `${this.frontendUrl}/orders/${orderId}`;
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_CONFIRMED,
      { to, name, orderId, orderUrl } satisfies OrderEmailJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderDispatchedEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    const orderUrl = `${this.frontendUrl}/orders/${orderId}`;
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_DISPATCHED,
      { to, name, orderId, orderUrl } satisfies OrderEmailJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderCancelledEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_CANCELLED,
      { to, name, orderId } satisfies OrderCancelledJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendOrderDeliveredEmail(
    to: string,
    name: string,
    orderId: number,
  ): Promise<void> {
    const orderUrl = `${this.frontendUrl}/orders/${orderId}/review`;
    await this.mailQueue.add(
      MailJobType.SEND_ORDER_DELIVERED,
      { to, name, orderId, orderUrl } satisfies OrderEmailJobData,
      MAIL_JOB_OPTIONS,
    );
  }

  async sendStockAlertEmail(data: StockAlertJobData): Promise<void> {
    await this.mailQueue.add(
      MailJobType.SEND_STOCK_ALERT,
      data,
      MAIL_JOB_OPTIONS,
    );
  }
}
