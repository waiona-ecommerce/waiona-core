import { ApiProperty } from '@nestjs/swagger';
import { ComboTaxEntity } from '../entities/combo-taxes.entity';

export class ComboTaxResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  comboId: number;

  @ApiProperty()
  taxId: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: ComboTaxEntity) {
    this.id = entity.id;
    this.comboId = entity.comboId;
    this.taxId = entity.taxId;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
