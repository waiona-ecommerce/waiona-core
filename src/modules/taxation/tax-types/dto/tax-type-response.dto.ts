import { ApiProperty } from '@nestjs/swagger';
import { TaxTypeEntity } from '../entities/tax-types.entity';

export class TaxTypeResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: TaxTypeEntity): TaxTypeResponseDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
