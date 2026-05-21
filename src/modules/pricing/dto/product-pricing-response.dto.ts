import { ApiProperty } from '@nestjs/swagger';
import { ProductPricingEntity } from '../entities/product-pricing.entity';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

export class ProductPricingResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  productId: number;

  @ApiProperty({ enum: CurrencyCode, example: CurrencyCode.ARS })
  currency: CurrencyCode;

  @ApiProperty({ example: 500 })
  unitPrice: number;

  @ApiProperty({ example: 1, nullable: true })
  marginId?: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: ProductPricingEntity) {
    this.id = entity.id;
    this.productId = entity.productId;
    this.currency = entity.currency;
    this.unitPrice = Number(entity.unitPrice);
    this.marginId = entity.margin?.id ?? null;

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
