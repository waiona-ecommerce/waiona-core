import { IsString, IsNotEmpty, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaxTypeDto {
  @ApiProperty({ example: 'IVA', minLength: 2, maxLength: 20 })
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  code: string;

  @ApiProperty({
    example: 'IMPUESTO AL VALOR AGREGADO',
    minLength: 3,
    maxLength: 150,
  })
  @Transform(({ value }) => value?.toUpperCase().trim())
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  name: string;
}
