import { ApiProperty } from '@nestjs/swagger';
import { MarginEntity } from '../entities/margin.entity';

export class MarginResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Margen estándar' })
  name: string;

  @ApiProperty({ example: 20 })
  value: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: MarginEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.value = Number(entity.value);
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
