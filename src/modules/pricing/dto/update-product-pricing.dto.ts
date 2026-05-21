import { PartialType, OmitType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { CreateProductPricingDto } from './create-product-pricing.dto';

export class UpdateProductPricingDto extends PartialType(
  OmitType(CreateProductPricingDto, ['productId', 'marginId'] as const),
) {
  @IsOptional()
  @ValidateIf((o) => o.marginId !== null)
  @IsInt()
  @Min(1)
  marginId?: number | null;
}
