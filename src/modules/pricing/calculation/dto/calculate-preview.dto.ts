import {
  IsNumber,
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
  @Max(100)
  value: number;
}

export class CalculatePreviewDto {
  // ==========================
  // Precio base (costo)
  // ==========================

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  // ==========================
  // Precio de venta (fijado por el admin)
  // ==========================

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  salePrice: number;

  // ==========================
  // Descuento (siempre porcentaje)
  // ==========================

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  discountValue?: number;

  // ==========================
  // Impuestos (siempre porcentaje)
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
  @Min(0.01)
  @Max(100)
  couponValue?: number;
}
