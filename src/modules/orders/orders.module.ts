import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { ProductEntity } from '../products/product/entities/product.entity';
import { ComboEntity } from '../products/combos/entities/combo.entity';
import { StockItemEntity } from '../stocks/stock-item/entities/stock-item.entity';

import { OrdersService } from './services/orders.service';
import { OrdersController } from './controllers/orders.controller';

import { StocksModule } from '../stocks/stocks.module';
import { CalculationModule } from '../pricing/calculation/calculation.module';
import { MailModule } from '../mail/mail.module';
import { UserEntity } from '../users/entities/user.entity';
import { CouponEntity } from '../coupons/coupon/entities/coupon.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      ComboEntity,
      StockItemEntity,
      UserEntity,
      CouponEntity,
    ]),
    StocksModule,
    CalculationModule,
    MailModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
