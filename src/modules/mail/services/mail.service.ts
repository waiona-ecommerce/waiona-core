import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import { Env } from 'src/env.model';
import { activationTemplate } from '../templates/activation.template';
import { resetPasswordTemplate } from '../templates/reset-password.template';

@Injectable()
export class MailService {

  private resend: Resend;
  private from: string;

  constructor(private readonly configService: ConfigService<Env>) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY', { infer: true }));
    this.from   = this.configService.get('MAIL_FROM', { infer: true }) ?? 'Waiona <onboarding@resend.dev>';
  }

  async sendActivationEmail(to: string, name: string, token: string): Promise<void> {
    const frontendUrl   = this.configService.get('FRONTEND_URL', { infer: true })!;
    const activationUrl = `${frontendUrl}/auth/activate?token=${token}`;

    await this.resend.emails.send({
      from:    this.from,
      to,
      subject: 'Activá tu cuenta en Waiona',
      html:    activationTemplate(name, activationUrl),
    });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', { infer: true })!;
    const resetUrl    = `${frontendUrl}/auth/reset-password?token=${token}`;

    await this.resend.emails.send({
      from:    this.from,
      to,
      subject: 'Recuperá tu contraseña en Waiona',
      html:    resetPasswordTemplate(name, resetUrl),
    });
  }
}