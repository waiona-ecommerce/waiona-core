import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarginsController } from './controllers/margins.controller';
import { MarginsService } from './services/margins.service';
import { MarginEntity } from './entities/margin.entity';
import { ProductPricingEntity } from 'src/modules/pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from 'src/modules/pricing/entities/combo-pricing.entity';
import { GuardsModule } from 'src/common/guards/guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarginEntity, ProductPricingEntity, ComboPricingEntity]),
    GuardsModule,
  ],
  controllers: [MarginsController],
  providers: [MarginsService],
  exports: [MarginsService], // opcional, útil si otro módulo lo usa
})
export class MarginsModule {}