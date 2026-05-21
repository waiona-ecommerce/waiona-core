import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockItemEntity } from '../entities/stock-item.entity';

export class StockItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  productId: number;

  @ApiProperty({ example: 1 })
  locationId: number;

  @ApiProperty({ example: 'Depósito Central' })
  locationName: string;

  @ApiProperty({ example: 100 })
  quantityCurrent: number;

  @ApiProperty({ example: 5 })
  quantityReserved: number;

  @ApiProperty({ example: 95 })
  quantityAvailable: number;

  @ApiProperty({ example: 10 })
  stockMin: number;

  @ApiProperty({ example: 5 })
  stockCritical: number;

  @ApiPropertyOptional({ example: 200 })
  stockMax?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: StockItemEntity) {
    this.id = entity.id;
    this.productId = entity.productId;
    this.locationId = entity.locationId;
    this.locationName = entity.location?.name ?? '';

    this.quantityCurrent = entity.quantityCurrent;
    this.quantityReserved = entity.quantityReserved;
    this.quantityAvailable = entity.quantityAvailable;

    this.stockMin = entity.stockMin;
    this.stockCritical = entity.stockCritical;
    this.stockMax = entity.stockMax ?? undefined;

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
