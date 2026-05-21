import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaxTypeDto {
  @ApiProperty({ example: 'IVA', minLength: 2, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  code: string;

  @ApiProperty({
    example: 'Impuesto al Valor Agregado',
    minLength: 3,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  name: string;
}
