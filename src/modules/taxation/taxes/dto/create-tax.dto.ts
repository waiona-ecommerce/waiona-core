import {
  IsString,
  IsNotEmpty,
  Length,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaxDto {
  @ApiProperty({ example: 'IVA', minLength: 2, maxLength: 20 })
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  code: string;

  @ApiProperty({
    example: 'Impuesto al Valor Agregado',
    minLength: 3,
    maxLength: 150,
  })
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  name: string;

  @ApiProperty({ example: 21, minimum: 0.01, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  value: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}
