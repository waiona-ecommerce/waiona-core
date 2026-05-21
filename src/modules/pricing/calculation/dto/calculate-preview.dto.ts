import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaxPreviewDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
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
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsBoolean()
  discountIsPercentage?: boolean;

  // ==========================
  // Margen
  // ==========================

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  marginValue?: number;

  @IsOptional()
  @IsBoolean()
  marginIsPercentage?: boolean;

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
