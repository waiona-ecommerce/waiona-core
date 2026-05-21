import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDiscountProductTargetDto {
  @ApiProperty({
    example: 1,
    description: 'ID del producto al que se asigna el descuento',
  })
  @IsInt()
  @Min(1)
  productId: number;
}
