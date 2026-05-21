import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class StockItemAddStockDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  locationId: number;

  @ApiProperty({ example: 50, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
