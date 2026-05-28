import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductPricingEntity } from '../entities/product-pricing.entity';
import { ComboPricingEntity } from '../entities/combo-pricing.entity';
import { ProductTaxEntity } from 'src/modules/taxation/product-taxes/entities/product-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';
import { DiscountProductTargetEntity } from 'src/modules/discounts/discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from 'src/modules/discounts/discount-combo-target/entities/discount-combo-target.entity';
import { ComboItemEntity } from 'src/modules/products/combos/entities/combo-item.entity';
import { CalculationService } from './services/calculation.service';
import { CalculationController } from './controllers/calculation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductPricingEntity,
      ComboPricingEntity,
      ProductTaxEntity,
      TaxEntity,
      DiscountProductTargetEntity,
      DiscountComboTargetEntity,
      ComboItemEntity,
    ]),
  ],
  controllers: [CalculationController],
  providers: [CalculationService],
  exports: [CalculationService],
})
export class CalculationModule {}
