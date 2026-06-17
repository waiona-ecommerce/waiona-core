import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscountEntity } from './discount/entities/discounts.entity';
import { DiscountProductTargetEntity } from './discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from './discount-combo-target/entities/discount-combo-target.entity';

import { DiscountsService } from './discount/services/discounts.service';
import { DiscountProductTargetService } from './discount-product-target/services/discount-product-target.service';
import { DiscountComboTargetService } from './discount-combo-target/services/discount-combo-target.service'; // 🔥 faltaba

import { DiscountsController } from './discount/controllers/discounts.controller';
import { DiscountProductTargetController } from './discount-product-target/controllers/discount-product-target.controller';
import { DiscountComboTargetController } from './discount-combo-target/controllers/discount-combo-target.controller'; // 🔥 faltaba

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiscountEntity,
      DiscountProductTargetEntity,
      DiscountComboTargetEntity,
    ]),
    // 🔥 GuardsModule eliminado — RolesGuard ya no necesita UserEntity
  ],
  providers: [
    DiscountsService,
    DiscountProductTargetService,
    DiscountComboTargetService,
  ],
  controllers: [
    DiscountsController,
    DiscountProductTargetController,
    DiscountComboTargetController,
  ],
  exports: [
    DiscountsService,
    DiscountProductTargetService,
    DiscountComboTargetService,
  ],
})
export class DiscountsModule {}
