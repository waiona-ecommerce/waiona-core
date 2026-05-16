import { IsString, IsNotEmpty, MaxLength, MinLength, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMarginDto {

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;

  @IsBoolean()
  isPercentage: boolean;
}