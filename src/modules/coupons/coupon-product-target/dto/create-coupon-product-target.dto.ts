import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCouponProductTargetDto {
  @ApiProperty({
    example: 1,
    description: 'ID del producto al que se asigna el cupón',
  })
  @IsInt()
  @Min(1)
  productId: number;
}
