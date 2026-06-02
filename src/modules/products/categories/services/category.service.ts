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

    if (changes.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: changes.parentId },
      });

      if (!parent) {
        throw new BadRequestException(
          `Categoría padre con id ${changes.parentId} no encontrada`,
        );
      }

      if (await this.wouldCreateCycle(id, changes.parentId)) {
        throw new BadRequestException(
          'Asignar esta categoría padre crearía una jerarquía circular',
        );
      }
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
        map.get(cat.parentId)?.children?.push(cat);
      } else {
        roots.push(cat);
      }
    }

    return roots.map((root) => new CategoryTreeResponseDto(root));
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async wouldCreateCycle(
    categoryId: number,
    newParentId: number,
  ): Promise<boolean> {
    let currentId: number | null = newParentId;
    while (currentId !== null) {
      if (currentId === categoryId) return true;
      const cat = await this.categoryRepository.findOne({
        where: { id: currentId },
      });
      currentId = cat?.parentId ?? null;
    }
    return false;
  }

  private async findOne(id: number): Promise<CategoryEntity> {
    const entity = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }

    return entity;
  }
}
