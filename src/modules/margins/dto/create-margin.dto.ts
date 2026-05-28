import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMarginDto {
  @ApiProperty({ example: 'MARGEN ESTÁNDAR', minLength: 3, maxLength: 100 })
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  name: string;

  @ApiProperty({
    example: 20,
    minimum: 0.01,
    maximum: 1000,
    description: 'Porcentaje de margen. Mín 0.01, máx 1000. Máx 2 decimales.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El valor debe ser un número con hasta 2 decimales' },
  )
  @Min(0.01, { message: 'El valor del margen debe ser mayor a 0' })
  @Max(1000, { message: 'El valor del margen no puede superar el 1000%' })
  value: number;
}
