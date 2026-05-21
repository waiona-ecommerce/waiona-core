import {
  IsOptional,
  IsString,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchShopDto {
  // ==========================
  // BÚSQUEDA
  // ==========================

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  // ==========================
  // FILTROS
  // ==========================

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @IsIn(['product', 'combo'])
  type?: 'product' | 'combo';

  // ==========================
  // FILTRO DE PRECIO
  // ==========================

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  // ==========================
  // PAGINACIÓN
  // ==========================

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
