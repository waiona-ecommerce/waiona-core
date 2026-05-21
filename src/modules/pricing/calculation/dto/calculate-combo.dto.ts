import { IsInt, Min } from 'class-validator';

export class CalculateComboDto {
  @IsInt()
  @Min(1)
  comboId: number;
}
