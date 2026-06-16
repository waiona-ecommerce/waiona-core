import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarginsController } from './controllers/margins.controller';
import { MarginsService } from './services/margins.service';
import { MarginEntity } from './entities/margin.entity';
import { ProductPricingEntity } from '../pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from '../pricing/entities/combo-pricing.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarginEntity,
      ProductPricingEntity,
      ComboPricingEntity,
    ]),
  ],
  controllers: [MarginsController],
  providers: [MarginsService],
  exports: [MarginsService],
})
export class MarginsModule {}
