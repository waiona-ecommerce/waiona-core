import {
    Injectable,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository, IsNull } from 'typeorm';
  
  import { CategoryEntity } from '../entities/category.entity';
  import { CreateCategoryDto } from '../dto/create-category.dto';
  import { UpdateCategoryDto } from '../dto/update-category.dto';
  import { CategoryResponseDto } from '../dto/category-response.dto';
  import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
  import { CategoryTreeResponseDto } from '../dto/category-tree-response.dto';
  
  @Injectable()
  export class CategoryService {
  
    constructor(
      @InjectRepository(CategoryEntity)
      private readonly categoryRepository: Repository<CategoryEntity>,
    ) {}
  
    // ==========================
    // GET ALL (plano)
    // ==========================
  
    async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<CategoryResponseDto>> {
      const [entities, total] = await this.categoryRepository.findAndCount({
        order: { name: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return new PaginatedResponseDto(entities.map(e => new CategoryResponseDto(e)), total, page, limit);
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
  
    async create(
      dto: CreateCategoryDto,
    ): Promise<CategoryResponseDto> {
  
      let parent: CategoryEntity | null = null;
  
      if (dto.parentId) {
        parent = await this.categoryRepository.findOne({
          where: {
            id: dto.parentId,
            
          },
        });
  
        if (!parent) {
          throw new BadRequestException(
            `Parent category with id ${dto.parentId} not found`,
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
            `Parent category with id ${changes.parentId} not found`,
          );
        }

        if (await this.wouldCreateCycle(id, changes.parentId)) {
          throw new BadRequestException(
            'Setting this parent would create a circular category hierarchy',
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
  
      await this.categoryRepository.softDelete(entity.id);
    }
  
    // ==========================
    // TREE (solo raíces)
    // ==========================
  
    async getTree(): Promise<CategoryTreeResponseDto[]> {
  
      const roots = await this.categoryRepository.find({
        where: {
          parentId: IsNull(),
          
        },
        relations: ['children'],
        order: {
          name: 'ASC',
        },
      });
  
      return roots.map(
        root => new CategoryTreeResponseDto(root),
      );
    }
  
    // ==========================
    // PRIVATE HELPERS
    // ==========================

    private async wouldCreateCycle(categoryId: number, newParentId: number): Promise<boolean> {
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

    // ==========================
    // PRIVATE FIND ONE
    // ==========================
  
    private async findOne(id: number): Promise<CategoryEntity> {
  
      const entity = await this.categoryRepository.findOne({
        where: {
          id,
          
        },
      });
  
      if (!entity) {
        throw new NotFoundException(
          `Category with id ${id} not found`,
        );
      }
  
      return entity;
    }
  }