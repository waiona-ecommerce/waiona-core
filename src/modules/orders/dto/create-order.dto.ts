import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryType } from '../enums/delivery-type.enum';

export class CreateOrderItemDto {

  @ApiProperty({ example: 1, required: false })
  @ValidateIf(o => !o.comboId)
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiProperty({ example: null, required: false })
  @ValidateIf(o => !o.productId)
  @IsInt()
  @Min(1)
  comboId?: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  quantity: number;
}

export class CreateOrderDto {

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({ enum: DeliveryType, example: DeliveryType.PICKUP })
  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  @ApiProperty({ example: 'Av. Corrientes 1234', required: false, nullable: true })
  @ValidateIf(o => o.deliveryType === DeliveryType.DELIVERY)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string;

  @ApiProperty({ example: 'PROMO10', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  couponCode?: string;

  @ApiProperty({ example: 'Sin cebolla', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
