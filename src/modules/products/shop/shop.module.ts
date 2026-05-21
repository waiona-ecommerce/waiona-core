import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ShopService } from './services/shop.service';
import { ShopController } from './controllers/shop.controller';

import { ProductEntity } from '../product/entities/product.entity';
import { ComboEntity } from '../combos/entities/combo.entity';

import { CalculationModule } from 'src/modules/pricing/calculation/calculation.module';

import { StocksModule } from 'src/modules/stocks/stocks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, ComboEntity]),
    CalculationModule,
    StocksModule,
  ],
  providers: [ShopService],
  controllers: [ShopController],
})
export class ShopModule {}
