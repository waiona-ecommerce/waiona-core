import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DiscountEntity } from '../entities/discounts.entity';

export class DiscountResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Black Friday' })
  name: string;

  @ApiPropertyOptional({ example: 'Descuento de temporada' })
  description?: string;

  @ApiProperty({ example: 10 })
  value: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: DiscountEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.description = entity.description ?? undefined;
    this.value = Number(entity.value);
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
