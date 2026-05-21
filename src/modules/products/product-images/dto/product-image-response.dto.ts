import { ProductImageEntity } from '../entities/product-image.entity';

export class ProductImageResponseDto {
  id: number;
  productId: number;
  url: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(entity: ProductImageEntity) {
    this.id = entity.id;
    this.productId = entity.productId;
    this.url = entity.url;
    this.position = entity.position;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
