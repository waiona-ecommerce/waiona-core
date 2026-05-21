import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductTaxDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  taxId: number;
}
