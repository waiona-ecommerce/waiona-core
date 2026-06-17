import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductTaxEntity } from '../entities/product-taxes.entity';
import { TaxResponseDto } from '../../taxes/dto/tax-response.dto';

export class ProductTaxResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  productId: number;

  @ApiProperty()
  taxId: number;

  @ApiPropertyOptional({ type: () => TaxResponseDto })
  tax?: TaxResponseDto;

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

    if (entity.tax) {
      this.tax = new TaxResponseDto(entity.tax);
    }
  }
}
