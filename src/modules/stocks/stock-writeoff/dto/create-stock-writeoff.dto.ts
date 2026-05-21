import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  IsArray,
} from 'class-validator';
import { StockWriteOffReason } from '../enums/stock-writeoff-reason.enum';

export class CreateStockWriteOffDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  stockItemId: number;

  @ApiProperty({ example: 3, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ enum: StockWriteOffReason })
  @IsEnum(StockWriteOffReason)
  reason: StockWriteOffReason;

  @ApiPropertyOptional({ example: 'Cajas rotas en tránsito', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.ejemplo.com/foto.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiProperty({
    example: 99,
    description: 'ID del usuario que reporta la baja',
  })
  @IsInt()
  @Min(1)
  reportedBy: number;
}
