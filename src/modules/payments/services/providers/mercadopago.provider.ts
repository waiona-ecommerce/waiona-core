import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Env } from 'src/env.model';
import { OrderEntity } from 'src/modules/orders/entities/order.entity';

@Injectable()
export class MercadoPagoProvider {

  private readonly client: MercadoPagoConfig;
  private readonly preference: Preference;

  constructor(private readonly configService: ConfigService<Env>) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get('MP_ACCESS_TOKEN', { infer: true })!,
    });

    this.preference = new Preference(this.client);
  }

  // 🔥 exponemos el cliente para usarlo en el webhook handler
  getClient(): MercadoPagoConfig {
    return this.client;
  }

  async createPreference(order: OrderEntity): Promise<{ id: string; checkoutUrl: string }> {

    // 🔥 URLs desde variables de entorno — nunca hardcodeadas
    const frontendUrl     = this.configService.get('FRONTEND_URL', { infer: true })!;
    const notificationUrl = this.configService.get('MP_NOTIFICATION_URL', { infer: true })!;

    const response = await this.preference.create({
      body: {
        items: [
          {
            id: String(order.id),
            title: `Orden #${order.id}`,
            quantity: 1,
            unit_price: Math.round(Number(order.total)),
            currency_id: 'ARS',
          },
        ],
        external_reference: String(order.id),
        back_urls: {
          success: `${frontendUrl}/payment/success`,
          failure: `${frontendUrl}/payment/failure`,
          pending: `${frontendUrl}/payment/pending`,
        },
        auto_return: 'approved',
        notification_url: notificationUrl,
      },
    });

    return {
      id: response.id!,
      checkoutUrl: response.init_point!,
    };
  }
}