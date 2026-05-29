import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateStockItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  locationId: number;

  @ApiProperty({ example: 5, minimum: 1, description: 'Debe ser al menos 1' })
  @IsInt()
  @Min(1)
  stockMin: number;

  @ApiProperty({
    example: 2,
    minimum: 0,
    description: 'Debe ser menor que stockMin',
  })
  @IsInt()
  @Min(0)
  stockCritical: number;
}
