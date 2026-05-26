import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StockLocationType } from '../enums/stock-location-type.enum';

// PartialType no se usa porque address acepta null para limpiar el campo.
// string | null no es asignable a string del Create DTO, así que se declara manualmente.
export class UpdateStockLocationDto {
  @ApiPropertyOptional({
    example: 'DEPÓSITO NORTE',
    minLength: 3,
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: StockLocationType })
  @IsOptional()
  @IsEnum(StockLocationType)
  type?: StockLocationType;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Enviar null para limpiar la dirección',
  })
  @IsOptional()
  @ValidateIf((o) => o.address !== null)
  @Transform(({ value }) => (value === null ? null : value?.trim()))
  @IsString()
  @MaxLength(255)
  address?: string | null;
}
