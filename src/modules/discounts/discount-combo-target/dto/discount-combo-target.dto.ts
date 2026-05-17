import { ApiProperty } from '@nestjs/swagger';

import { DiscountComboTargetEntity } from '../entities/discount-combo-target.entity';

export class DiscountComboTargetResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  discountId: number;

  @ApiProperty({ example: 1 })
  comboId: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: DiscountComboTargetEntity) {
    this.id = entity.id;
    this.discountId = entity.discountId;
    this.comboId = entity.comboId;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
