import { CategoryEntity } from '../entities/category.entity';

export class CategoryTreeResponseDto {
  id: number;
  name: string;
  children: CategoryTreeResponseDto[];

  constructor(entity: CategoryEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.children = entity.children
      ? entity.children.map((child) => new CategoryTreeResponseDto(child))
      : [];
  }
}
