import {
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsDate,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { CurrencyCode } from 'src/common/enums/currency-code.enum';

export class CreateCouponDto {
  @ApiProperty({ example: 'PROMO10' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  code: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999)
  value: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isPercentage: boolean;

  @ApiProperty({
    enum: CurrencyCode,
    required: false,
    nullable: true,
    example: 'ARS',
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @ApiProperty({ example: false })
  @IsBoolean()
  isGlobal: boolean;

  @ApiProperty({ required: false, nullable: true, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
}
