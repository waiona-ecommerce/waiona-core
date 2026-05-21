import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { StockLocationType } from '../enums/stock-location-type.enum';

export class CreateStockLocationDto {
  @ApiProperty({ example: 'Depósito Central', minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: StockLocationType })
  @IsEnum(StockLocationType)
  type: StockLocationType;

  @ApiPropertyOptional({ example: 'Av. Corrientes 1234', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
