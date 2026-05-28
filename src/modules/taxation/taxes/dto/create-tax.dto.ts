import { IsNumber, IsBoolean, Min, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

export class CreateTaxDto {
  @ApiProperty({ example: 21, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isPercentage: boolean;

  @ApiPropertyOptional({ enum: CurrencyCode, example: CurrencyCode.ARS })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}
