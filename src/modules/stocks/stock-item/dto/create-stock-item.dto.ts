import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateStockItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  locationId: number;

  @ApiProperty({ example: 5, minimum: 0 })
  @IsInt()
  @Min(0)
  stockMin: number;

  @ApiProperty({
    example: 2,
    minimum: 0,
    description: 'Debe ser menor que stockMin',
  })
  @IsInt()
  @Min(0)
  stockCritical: number;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    description: 'Debe ser mayor que stockMin',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockMax?: number;
}
