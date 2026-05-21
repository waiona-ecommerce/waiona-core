import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCouponUsageDto {
  @ApiProperty({ example: 'PROMO10' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  code: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  orderId: number;

  @ApiProperty({
    required: false,
    description: 'Inferido del JWT — no enviar desde el cliente',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;
}
