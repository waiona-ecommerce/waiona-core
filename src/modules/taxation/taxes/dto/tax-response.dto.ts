import { ApiProperty } from '@nestjs/swagger';
import { TaxEntity } from '../entities/tax.entity';

export class TaxResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  value: number;

  @ApiProperty()
  isGlobal: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: TaxEntity) {
    this.id = entity.id;
    this.code = entity.code;
    this.name = entity.name;
    this.value = Number(entity.value);
    this.isGlobal = entity.isGlobal;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
