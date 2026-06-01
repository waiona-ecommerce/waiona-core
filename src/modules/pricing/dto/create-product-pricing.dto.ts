import { IsInt, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';

export class CreateProductPricingDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ enum: CurrencyCode, example: CurrencyCode.ARS })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ example: 500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 1, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  marginId?: number;
}
