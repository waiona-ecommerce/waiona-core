import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StockItemsController } from './stock-item/controllers/stock-item.controller';
import { StockItemsService } from './stock-item/services/stock-item.service';

import { StockLocationsService } from './stock-locations/services/stock-locations.service';
import { StockLocationsController } from './stock-locations/controllers/stock-locations.controller';

import { StockMovementService } from './stock-movement/services/stock-movement.service';
import { StockMovementController } from './stock-movement/controllers/stock-movement.controller';

import { StockWriteOffService } from './stock-writeoff/services/stock-writeoff.service';
import { StockWriteOffController } from './stock-writeoff/controllers/stock-writeoff.controller';

import { StockLocationEntity } from './stock-locations/entities/stock-locations.entity';
import { StockMovementEntity } from './stock-movement/entities/stock-movement.entity';
import { StockItemEntity } from './stock-item/entities/stock-item.entity';
import { StockWriteOffEntity } from './stock-writeoff/entities/stock-writeoff.entity';

import { ComboItemEntity } from 'src/modules/products/combos/entities/combo-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockLocationEntity,
      StockMovementEntity,
      StockItemEntity,
      StockWriteOffEntity,
      ComboItemEntity,
    ]),
  ],
  providers: [
    StockLocationsService,
    StockMovementService,
    StockItemsService,
    StockWriteOffService,
  ],
  controllers: [
    StockLocationsController,
    StockMovementController,
    StockItemsController,
    StockWriteOffController,
  ],
  exports: [StockLocationsService, StockMovementService, StockItemsService],
})
export class StocksModule {}
