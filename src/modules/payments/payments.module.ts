import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { PaymentEntity } from './entities/payment.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';

import { PaymentsService } from './services/payments.service';
import { MercadoPagoProvider } from './services/providers/mercadopago.provider';
import { PaymentsController } from './controllers/payments.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PaymentEntity, OrderEntity]),
    OrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
