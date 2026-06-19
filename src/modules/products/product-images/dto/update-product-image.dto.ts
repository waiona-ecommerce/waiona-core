import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProductImageDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  url?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}
