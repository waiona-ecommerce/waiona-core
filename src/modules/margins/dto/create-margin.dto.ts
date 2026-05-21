import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMarginDto {
  @ApiProperty({ example: 'Margen estándar', minLength: 3, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 20,
    minimum: 0,
    description: 'Máx 2 decimales. Si isPercentage es true, máx 100.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;

  @ApiProperty({
    example: true,
    description: 'true = porcentaje, false = monto fijo',
  })
  @IsBoolean()
  isPercentage: boolean;
}
