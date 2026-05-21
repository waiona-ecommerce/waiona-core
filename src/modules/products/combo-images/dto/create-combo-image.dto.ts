import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateComboImageDto {
  @IsInt()
  @Min(1)
  comboId: number;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  url: string;

  @IsInt()
  @Min(1)
  position: number;
}
