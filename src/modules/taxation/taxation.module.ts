import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaxesController } from './taxes/controllers/taxes.controller';
import { TaxesService } from './taxes/services/taxes.service';
import { TaxEntity } from './taxes/entities/tax.entity';

import { ProductTaxesService } from './product-taxes/services/product-taxes.service';
import { ProductTaxesController } from './product-taxes/controllers/product-taxes.controller';
import { ProductTaxEntity } from './product-taxes/entities/product-taxes.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaxEntity, ProductTaxEntity])],
  controllers: [TaxesController, ProductTaxesController],
  providers: [TaxesService, ProductTaxesService],
  exports: [TaxesService, ProductTaxesService],
})
export class TaxationModule {}
