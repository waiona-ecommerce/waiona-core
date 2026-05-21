import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateStockThresholdsDto {
  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockMin?: number;

  @ApiPropertyOptional({
    example: 3,
    minimum: 0,
    description: 'Debe ser menor que stockMin',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockCritical?: number;

  @ApiPropertyOptional({
    example: 200,
    minimum: 0,
    description: 'Debe ser mayor que stockMin',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockMax?: number;
}
