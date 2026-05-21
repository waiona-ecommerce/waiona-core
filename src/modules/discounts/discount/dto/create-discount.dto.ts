import {
  IsString,
  MaxLength,
  MinLength,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CurrencyCode } from 'src/common/enums/currency-code.enum';

export class CreateDiscountDto {
  // ==========================
  // BASIC INFO
  // ==========================

  @ApiProperty({ example: 'Black Friday', minLength: 3, maxLength: 100 })
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
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string;

  // ==========================
  // VALUE
  // ==========================

  @ApiProperty({ example: 10, minimum: 0.01, maximum: 99999999 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999)
  value: number;

  @ApiProperty({
    example: true,
    description: 'true = porcentaje, false = monto fijo',
  })
  @IsBoolean()
  isPercentage: boolean;

  @ApiPropertyOptional({
    enum: CurrencyCode,
    example: CurrencyCode.ARS,
    description: 'Requerido si isPercentage = false',
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  // ==========================
  // DATES
  // ==========================

  @ApiPropertyOptional({ example: '2025-11-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @ApiPropertyOptional({ example: '2025-11-30T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
}
