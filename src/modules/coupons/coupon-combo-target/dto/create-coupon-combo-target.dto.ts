import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCouponComboTargetDto {
  @ApiProperty({
    example: 1,
    description: 'ID del combo al que se asigna el cupón',
  })
  @IsInt()
  @Min(1)
  comboId: number;
}
