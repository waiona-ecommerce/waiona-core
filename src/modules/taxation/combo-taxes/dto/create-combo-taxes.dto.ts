import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateComboTaxDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  taxId: number;
}
