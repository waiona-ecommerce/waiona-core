import { ApiProperty } from '@nestjs/swagger';

import { OrderEntity } from '../entities/order.entity';
import { OrderItemEntity } from '../entities/order-item.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { DeliveryType } from '../enums/delivery-type.enum';

export class OrderItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 3, nullable: true })
  productId: number | null;

  @ApiProperty({ example: 'Milanesa napolitana', nullable: true })
  productName: string | null;

  @ApiProperty({ example: null, nullable: true })
  comboId: number | null;

  @ApiProperty({ example: null, nullable: true })
  comboName: string | null;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 1500 })
  unitPrice: number;

  @ApiProperty({ example: 3000 })
  finalPrice: number;

  constructor(entity: OrderItemEntity) {
    this.id = entity.id;
    this.productId = entity.product?.id ?? null;
    this.productName = entity.product?.name ?? null;
    this.comboId = entity.combo?.id ?? null;
    this.comboName = entity.combo?.name ?? null;
    this.quantity = entity.quantity;
    this.unitPrice = entity.unitPrice;
    this.finalPrice = entity.finalPrice;
  }
}

export class OrderResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ example: 7 })
  userId: number;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiProperty({ enum: DeliveryType, example: DeliveryType.DELIVERY })
  deliveryType: DeliveryType;

  @ApiProperty({ example: 'Av. Corrientes 1234', nullable: true })
  address: string | null;

  @ApiProperty({ example: 'Sin cebolla', nullable: true })
  notes: string | null;

  @ApiProperty({ example: 3000 })
  subtotal: number;

  @ApiProperty({ example: 300, nullable: true })
  couponDiscount: number | null;

  @ApiProperty({ example: 'PROMO10', nullable: true })
  couponCode: string | null;

  @ApiProperty({ example: 2700 })
  total: number;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  constructor(entity: OrderEntity) {
    this.id = entity.id;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
    this.userId = entity.user?.id ?? entity.userId;
    this.status = entity.status;
    this.deliveryType = entity.deliveryType;
    this.address = entity.address ?? null;
    this.notes = entity.notes ?? null;
    this.subtotal = entity.subtotal;
    this.couponDiscount = entity.couponDiscount ?? null;
    this.couponCode = entity.coupon?.code ?? null;
    this.total = entity.total;
    this.items = (entity.items ?? []).map((i) => new OrderItemResponseDto(i));
  }
}
