import { ProductEntity } from '../entities/product.entity';

export class ProductResponseDto {
  id: number;
  sku: string;
  name: string;
  description: string;
  isActive: boolean;

  categoryId: number;
  categoryName: string;

  measurementUnit: string;
  measurementValue?: number;

  createdAt: Date;
  updatedAt: Date;

  constructor(entity: ProductEntity) {
    this.id = entity.id;
    this.sku = entity.sku;
    this.name = entity.name;
    this.description = entity.description;
    this.isActive = entity.isActive;

    this.categoryId = entity.categoryId;
    this.categoryName = entity.category?.name ?? ''; // ok si se carga la relación

    this.measurementUnit = entity.measurementUnit;
    this.measurementValue =
      entity.measurementValue != null
        ? Number(entity.measurementValue)
        : undefined;

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
