import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class StockItemWriteOffDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  stockItemId: number;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
