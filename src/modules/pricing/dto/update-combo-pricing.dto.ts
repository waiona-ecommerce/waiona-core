import { PartialType, OmitType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { CreateComboPricingDto } from './create-combo-pricing.dto';

export class UpdateComboPricingDto extends PartialType(
  OmitType(CreateComboPricingDto, ['comboId', 'marginId'] as const),
) {
  @IsOptional()
  @ValidateIf((o) => o.marginId !== null)
  @IsInt()
  @Min(1)
  marginId?: number | null;
}
