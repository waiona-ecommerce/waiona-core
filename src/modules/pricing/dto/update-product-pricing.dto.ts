import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductPricingDto } from './create-product-pricing.dto';

export class UpdateProductPricingDto extends PartialType(
  OmitType(CreateProductPricingDto, ['productId'] as const),
) {}
