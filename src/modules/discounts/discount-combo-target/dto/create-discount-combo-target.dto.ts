import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDiscountComboTargetDto {
  @ApiProperty({
    example: 1,
    description: 'ID del combo al que se asigna el descuento',
  })
  @IsInt()
  @Min(1)
  comboId: number;
}
