import {
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDiscountDto {
  // ==========================
  // BASIC INFO
  // ==========================

  @ApiProperty({ example: 'BLACK FRIDAY', minLength: 3, maxLength: 100 })
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Descuento de temporada',
    minLength: 3,
    maxLength: 255,
  })
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string;

  // ==========================
  // VALUE (siempre porcentaje)
  // ==========================

  @ApiProperty({
    example: 10,
    minimum: 0.01,
    maximum: 100,
    description: 'Porcentaje de descuento. Mín 0.01, máx 100.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  value: number;
}
