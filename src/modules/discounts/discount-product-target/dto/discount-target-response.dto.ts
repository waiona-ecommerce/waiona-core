import { ApiProperty } from '@nestjs/swagger';

import { DiscountProductTargetEntity } from '../entities/discount-product-target.entity';

export class DiscountProductTargetResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  discountId: number;

  @ApiProperty({ example: 1 })
  productId: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: DiscountProductTargetEntity) {
    this.id = entity.id;
    this.discountId = entity.discountId;
    this.productId = entity.productId;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
