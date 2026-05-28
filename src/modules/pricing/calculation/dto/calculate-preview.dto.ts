import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaxPreviewDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @IsBoolean()
  isPercentage: boolean;
}

export class CalculatePreviewDto {
  // ==========================
  // Precio base
  // ==========================

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  // ==========================
  // Descuento
  // ==========================

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  discountValue?: number;

  // ==========================
  // Margen (siempre porcentaje)
  // ==========================

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  marginValue?: number;

  // ==========================
  // Impuestos
  // ==========================

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxPreviewDto)
  taxes?: TaxPreviewDto[];

  // ==========================
  // Cupón (nivel orden)
  // ==========================

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  couponValue?: number;

  @IsOptional()
  @IsBoolean()
  couponIsPercentage?: boolean;
}
