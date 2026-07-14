import { IsInt, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';

export class CreateComboPricingDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  comboId: number;

  @ApiProperty({ enum: CurrencyCode, example: CurrencyCode.ARS })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ example: 1200 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  unitPrice: number;

  @ApiProperty({ example: 1500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  salePrice: number;
}
