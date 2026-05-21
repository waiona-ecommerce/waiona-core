import { ApiProperty } from '@nestjs/swagger';
import { ProductTaxEntity } from '../entities/product-taxes.entity';

export class ProductTaxResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  productId: number;

  @ApiProperty()
  taxId: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: ProductTaxEntity) {
    this.id = entity.id;
    this.productId = entity.productId;
    this.taxId = entity.taxId;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
