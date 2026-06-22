import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateProductImageDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}
