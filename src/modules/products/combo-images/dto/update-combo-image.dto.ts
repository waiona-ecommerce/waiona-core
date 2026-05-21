import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateComboImageDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}
