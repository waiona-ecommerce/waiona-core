import {
  IsString,
  MaxLength,
  IsBoolean,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
  MinLength,
  IsNotEmpty,
  IsArray,
} from 'class-validator';

import { Type, Transform } from 'class-transformer';

// ==========================
// CREATE ITEM
// ==========================

export class CreateComboItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

// ==========================
// CREATE COMBO
// ==========================

export class CreateComboDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  description: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ==========================
  // Categoría
  // ==========================

  @IsInt()
  @Min(1)
  categoryId: number;

  // ==========================
  // Items
  // ==========================

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateComboItemDto)
  items: CreateComboItemDto[];
}
