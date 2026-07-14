import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductPricingEntity } from './entities/product-pricing.entity';
import { ComboPricingEntity } from './entities/combo-pricing.entity';

import { ProductPricingService } from './services/product-pricing.service';
import { ComboPricingService } from './services/combo-pricing.service';
import { ComboPricingController } from './controllers/combo-pricing.controller';
import { ProductPricingController } from './controllers/product-pricing.controller';
import { CalculationModule } from './calculation/calculation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductPricingEntity, ComboPricingEntity]),
    CalculationModule,
  ],
  providers: [ProductPricingService, ComboPricingService],
  controllers: [ComboPricingController, ProductPricingController],
  exports: [ProductPricingService, ComboPricingService, CalculationModule],
})
export class PricingModule {}
