import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CategoryEntity } from '../entities/category.entity';
import { ProductEntity } from '../../product/entities/product.entity';
import { ComboEntity } from '../../combos/entities/combo.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryResponseDto } from '../dto/category-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { CategoryTreeResponseDto } from '../dto/category-tree-response.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,
  ) {}

  // ==========================
  // GET ALL (plano)
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<CategoryResponseDto>> {
    const [entities, total] = await this.categoryRepository.findAndCount({
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      entities.map((e) => new CategoryResponseDto(e)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findById(id: number): Promise<CategoryResponseDto> {
    const entity = await this.findOne(id);

    return new CategoryResponseDto(entity);
  }

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    await this.validateUniqueName(dto.name);

    let parent: CategoryEntity | null = null;

    if (dto.parentId) {
      parent = await this.categoryRepository.findOne({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new BadRequestException(
          `Categoría padre con id ${dto.parentId} no encontrada`,
        );
      }
    }

    const entity = this.categoryRepository.create({
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive ?? true,
      parentId: parent ? parent.id : null,
    });

    const saved = await this.categoryRepository.save(entity);

    return new CategoryResponseDto(saved);
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    changes: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const entity = await this.findOne(id);

    if (changes.name && changes.name !== entity.name) {
      await this.validateUniqueName(changes.name);
    }

    const merged = this.categoryRepository.merge(entity, changes);

    const saved = await this.categoryRepository.save(merged);

    return new CategoryResponseDto(saved);
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async delete(id: number): Promise<void> {
    const entity = await this.findOne(id);

    const childrenCount = await this.categoryRepository.count({
      where: { parentId: id },
    });
    if (childrenCount > 0) {
      throw new ConflictException(
        `No se puede eliminar: la categoría tiene ${childrenCount} subcategoría(s) asignada(s)`,
      );
    }

    const productCount = await this.productRepository.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `No se puede eliminar: la categoría tiene ${productCount} producto(s) asignado(s)`,
      );
    }

    const comboCount = await this.comboRepository.count({
      where: { categoryId: id },
    });
    if (comboCount > 0) {
      throw new ConflictException(
        `No se puede eliminar: la categoría tiene ${comboCount} combo(s) asignado(s)`,
      );
    }

    await this.categoryRepository.softDelete(entity.id);
  }

  // ==========================
  // TREE (solo raíces)
  // ==========================

  async getTree(): Promise<CategoryTreeResponseDto[]> {
    const all = await this.categoryRepository.find({
      order: { name: 'ASC' },
    });

    for (const cat of all) {
      cat.children = [];
    }

    const map = new Map(all.map((cat) => [cat.id, cat]));
    const roots: CategoryEntity[] = [];

    for (const cat of all) {
      if (cat.parentId != null) {
        const parent = map.get(cat.parentId);
        if (parent) {
          parent.children!.push(cat);
        } else {
          roots.push(cat);
        }
      } else {
        roots.push(cat);
      }
    }

    return roots.map((root) => new CategoryTreeResponseDto(root));
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findOne(id: number): Promise<CategoryEntity> {
    const entity = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }

    return entity;
  }

  private async validateUniqueName(name: string): Promise<void> {
    const existing = await this.categoryRepository.findOne({
      where: { name },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe una categoría con el nombre "${name}"`,
      );
    }
  }
}
