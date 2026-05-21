import { IsInt, Min } from 'class-validator';

export class CalculateProductDto {
  @IsInt()
  @Min(1)
  productId: number;
}
