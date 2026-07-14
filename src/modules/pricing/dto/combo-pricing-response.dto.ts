import { ApiProperty } from '@nestjs/swagger';
import { ComboPricingEntity } from '../entities/combo-pricing.entity';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';

export class ComboPricingResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  comboId: number;

  @ApiProperty({ enum: CurrencyCode, example: CurrencyCode.ARS })
  currency: CurrencyCode;

  @ApiProperty({ example: 1200 })
  unitPrice: number;

  @ApiProperty({ example: 1500 })
  salePrice: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: ComboPricingEntity) {
    this.id = entity.id;
    this.comboId = entity.comboId;
    this.currency = entity.currency;
    this.unitPrice = Number(entity.unitPrice);
    this.salePrice = Number(entity.salePrice);
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
