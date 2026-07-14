import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'BEBIDAS', minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Bebidas en general',
    minLength: 5,
    maxLength: 255,
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'La descripción debe ser texto' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía' })
  @MinLength(5, { message: 'La descripción debe tener al menos 5 caracteres' })
  @MaxLength(255, {
    message: 'La descripción no puede superar los 255 caracteres',
  })
  description?: string;
}
