import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxEntity } from '../entities/tax.entity';
import { TaxTypeResponseDto } from '../../tax-types/dto/tax-type-response.dto';

export class TaxResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  taxTypeId: number;

  @ApiProperty()
  value: number;

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
    this.isGlobal = entity.isGlobal;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;

    if (entity.taxType) {
      this.taxType = TaxTypeResponseDto.fromEntity(entity.taxType);
    }
  }
}
