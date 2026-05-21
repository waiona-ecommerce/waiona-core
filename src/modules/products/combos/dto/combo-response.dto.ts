import { ComboEntity } from '../entities/combo.entity';
import { ComboItemEntity } from '../entities/combo-item.entity';

class ComboItemResponseDto {
  productId: number;
  productName: string;
  quantity: number;

  constructor(entity: ComboItemEntity) {
    this.productId = entity.productId;
    this.productName = entity.product?.name ?? '';
    this.quantity = entity.quantity;
  }
}

export class ComboResponseDto {
  id: number;
  name: string;
  description: string;
  isActive: boolean;

  categoryId: number;
  categoryName: string; // útil para el front sin join extra

  items: ComboItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;

  constructor(entity: ComboEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.description = entity.description;
    this.isActive = entity.isActive;

    this.categoryId = entity.categoryId;
    this.categoryName = entity.category?.name ?? '';

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;

    this.items = entity.items
      ? entity.items.map((item) => new ComboItemResponseDto(item))
      : [];
  }
}
