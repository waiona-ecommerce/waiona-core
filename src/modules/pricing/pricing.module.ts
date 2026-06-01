import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductPricingEntity } from './entities/product-pricing.entity';
import { ComboPricingEntity } from './entities/combo-pricing.entity';
import { MarginEntity } from '../margins/entities/margin.entity';

import { ProductPricingService } from './services/product-pricing.service';
import { ComboPricingService } from './services/combo-pricing.service';
import { ComboPricingController } from './controllers/combo-pricing.controller';
import { ProductPricingController } from './controllers/product-pricing.controller';
import { CalculationModule } from './calculation/calculation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductPricingEntity,
      ComboPricingEntity,
      MarginEntity,
    ]),
    CalculationModule,
  ],
  providers: [ProductPricingService, ComboPricingService],
  controllers: [ComboPricingController, ProductPricingController],
  exports: [
    ProductPricingService,
    ComboPricingService,
    CalculationModule, // 🔥 exporta CalculationModule para que otros módulos puedan usar CalculationService
  ],
})
export class PricingModule {}
