import { CategoryEntity } from '../entities/category.entity';

export class CategoryResponseDto {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  parentId?: number | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(entity: CategoryEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.description = entity.description;
    this.isActive = entity.isActive;
    this.parentId = entity.parentId ?? null;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
