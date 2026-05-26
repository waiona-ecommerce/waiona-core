import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductMeasurementUnit } from '../enums/product-measurement-unit.enum';

export class CreateProductDto {
  // ==========================
  // Identificación
  // ==========================

  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  sku: string;

  // ==========================
  // Información básica
  // ==========================

  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  description: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ==========================
  // Categoría
  // ==========================

  @IsInt()
  @Min(1)
  categoryId: number;

  // ==========================
  // Unidad de medida
  // ==========================

  @IsEnum(ProductMeasurementUnit)
  measurementUnit: ProductMeasurementUnit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  measurementValue?: number;
}
