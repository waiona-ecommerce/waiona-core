import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaxesController } from './taxes/controllers/taxes.controller';
import { TaxesService } from './taxes/services/taxes.service';
import { TaxEntity } from './taxes/entities/tax.entity';

import { TaxTypesController } from './tax-types/controllers/tax-types.controller';
import { TaxTypesService } from './tax-types/services/tax-types.service';
import { TaxTypeEntity } from './tax-types/entities/tax-types.entity';

import { ComboTaxesService } from './combo-taxes/services/combo-taxes.service';
import { ComboTaxesController } from './combo-taxes/controllers/combo-taxes.controller';
import { ComboTaxEntity } from './combo-taxes/entities/combo-taxes.entity';

import { ProductTaxesService } from './product-taxes/services/product-taxes.service';
import { ProductTaxesController } from './product-taxes/controllers/product-taxes.controller';
import { ProductTaxEntity } from './product-taxes/entities/product-taxes.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxEntity,
      TaxTypeEntity,
      ProductTaxEntity,
      ComboTaxEntity,
    ]),
  ],
  controllers: [
    TaxesController,
    TaxTypesController,
    ComboTaxesController,
    ProductTaxesController,
  ],
  providers: [
    TaxesService,
    TaxTypesService,
    ProductTaxesService,
    ComboTaxesService,
  ],
  exports: [
    TaxesService,
    TaxTypesService,
    ProductTaxesService,
    ComboTaxesService,
  ],
})
export class TaxationModule {}
