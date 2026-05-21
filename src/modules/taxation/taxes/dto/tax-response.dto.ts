import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxEntity } from '../entities/tax.entity';
import { TaxTypeResponseDto } from '../../tax-types/dto/tax-type-response.dto';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

export class TaxResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  taxTypeId: number;

  @ApiProperty()
  value: number;

  @ApiProperty()
  isPercentage: boolean;

  @ApiPropertyOptional({ enum: CurrencyCode })
  currency?: CurrencyCode;

  @ApiProperty()
  isGlobal: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => TaxTypeResponseDto })
  taxType?: TaxTypeResponseDto;

  constructor(entity: TaxEntity) {
    this.id = entity.id;
    this.taxTypeId = entity.taxTypeId;
    this.value = Number(entity.value);
    this.isPercentage = entity.isPercentage;
    this.currency = entity.currency;
    this.isGlobal = entity.isGlobal;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;

    if (entity.taxType) {
      this.taxType = TaxTypeResponseDto.fromEntity(entity.taxType);
    }
  }
}
