import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockLocationEntity } from '../entities/stock-locations.entity';
import { StockLocationType } from '../enums/stock-location-type.enum';

export class StockLocationResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Depósito Central' })
  name: string;

  @ApiProperty({ enum: StockLocationType })
  type: StockLocationType;

  @ApiPropertyOptional({ example: 'Av. Corrientes 1234' })
  address?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: StockLocationEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.type = entity.type;
    this.address = entity.address ?? undefined;

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
