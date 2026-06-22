import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateComboImageDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}
