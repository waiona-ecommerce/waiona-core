import { IsInt, ValidateNested, IsOptional, Min } from 'class-validator';

import { Type } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateComboDto } from './create-combo.dto';

// ==========================
// UPDATE ITEM
// ==========================

export class UpdateComboItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

// ==========================
// UPDATE COMBO
// ==========================

export class UpdateComboDto extends PartialType(
  OmitType(CreateComboDto, ['items'] as const),
) {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateComboItemDto)
  items?: UpdateComboItemDto[];
}
