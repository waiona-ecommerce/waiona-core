import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CouponEntity } from './coupon/entities/coupon.entity';
import { CouponProductTargetEntity } from './coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from './coupon-combo-target/entities/coupon-combo-target.entity';
import { CouponUsageEntity } from './usage/entities/coupon-usage.entity';
import { ProductEntity } from '../products/product/entities/product.entity';
import { ComboEntity } from '../products/combos/entities/combo.entity';

import { CouponService } from './coupon/services/coupon.service';
import { CouponProductTargetService } from './coupon-product-target/services/coupon-product-target.service';
import { CouponComboTargetService } from './coupon-combo-target/services/coupon-combo-target.service';
import { CouponUsageService } from './usage/services/coupon-usage.service';
import { CouponUsageController } from './usage/controllers/coupon-usage.controller';

import { CouponController } from './coupon/controllers/coupon.controller';
import { CouponProductTargetController } from './coupon-product-target/controllers/coupon-product-target.controller';
import { CouponComboTargetController } from './coupon-combo-target/controllers/coupon-combo-target.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CouponEntity,
      CouponProductTargetEntity,
      CouponComboTargetEntity,
      CouponUsageEntity,
      ProductEntity,
      ComboEntity,
    ]),
  ],
  controllers: [
    CouponController,
    CouponProductTargetController,
    CouponComboTargetController,
    CouponUsageController, // 🔥 faltaba registrar
  ],
  providers: [
    CouponService,
    CouponProductTargetService,
    CouponComboTargetService,
    CouponUsageService,
  ],
  exports: [
    CouponService,
    CouponUsageService, // 🔥 exportado para que órdenes lo consuma
  ],
})
export class CouponsModule {}
