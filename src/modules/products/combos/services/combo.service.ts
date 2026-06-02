import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { ComboEntity } from '../entities/combo.entity';
import { ComboItemEntity } from '../entities/combo-item.entity';
import { ProductEntity } from '../../product/entities/product.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';

import { CreateComboDto } from '../dto/create-combo.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { ComboResponseDto } from '../dto/combo-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { ShopCacheService } from '../../../../common/cache/shop-cache.service';

@Injectable()
export class ComboService {
  constructor(
    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,

    @InjectRepository(ComboItemEntity)
    private readonly comboItemRepository: Repository<ComboItemEntity>,

    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    private readonly dataSource: DataSource,
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<ComboResponseDto>> {
    const [combos, total] = await this.comboRepository.findAndCount({
      relations: ['category', 'items', 'items.product'],
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      combos.map((combo) => new ComboResponseDto(combo)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findById(id: number): Promise<ComboResponseDto> {
    const combo = await this.findOne(id);

    return new ComboResponseDto(combo);
  }

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateComboDto): Promise<ComboResponseDto> {
    await this.validateCategoryExists(dto.categoryId);

    const result = await this.dataSource.transaction(async (manager) => {
      await this.validateItems(dto.items);

      const combo = manager.create(ComboEntity, {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
      });

      const savedCombo = await manager.save(combo);

      const items = dto.items.map((item) =>
        manager.create(ComboItemEntity, {
          comboId: savedCombo.id,
          productId: item.productId,
          quantity: item.quantity,
        }),
      );

      await manager.save(items);

      const fullCombo = await manager.findOne(ComboEntity, {
        where: { id: savedCombo.id },
        relations: ['category', 'items', 'items.product'],
      });

      return new ComboResponseDto(fullCombo!);
    });

    return result;
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, dto: UpdateComboDto): Promise<ComboResponseDto> {
    if (dto.categoryId !== undefined) {
      await this.validateCategoryExists(dto.categoryId);
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const combo = await manager.findOne(ComboEntity, {
        where: { id },
      });

      if (!combo) {
        throw new NotFoundException(`Combo con id ${id} no encontrado`);
      }

      manager.merge(ComboEntity, combo, {
        name: dto.name ?? combo.name,
        description: dto.description ?? combo.description,
        isActive: dto.isActive ?? combo.isActive,
        categoryId: dto.categoryId ?? combo.categoryId,
      });

      await manager.save(combo);

      if (dto.items) {
        await this.validateItems(dto.items);

        await manager.softDelete(ComboItemEntity, { comboId: combo.id });

        const newItems = dto.items.map((item) =>
          manager.create(ComboItemEntity, {
            comboId: combo.id,
            productId: item.productId,
            quantity: item.quantity,
          }),
        );

        await manager.save(newItems);
      }

      const fullCombo = await manager.findOne(ComboEntity, {
        where: { id: combo.id },
        relations: ['category', 'items', 'items.product'],
      });

      return new ComboResponseDto(fullCombo!);
    });

    void this.shopCacheService.invalidate();
    return result;
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async delete(id: number): Promise<void> {
    const combo = await this.comboRepository.findOne({
      where: { id },
    });

    if (!combo) {
      throw new NotFoundException(`Combo con id ${id} no encontrado`);
    }

    await this.comboRepository.softDelete(combo.id);
    void this.shopCacheService.invalidate();
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findOne(id: number): Promise<ComboEntity> {
    const combo = await this.comboRepository.findOne({
      where: { id },
      relations: ['category', 'items', 'items.product'],
    });

    if (!combo) {
      throw new NotFoundException(`Combo con id ${id} no encontrado`);
    }

    return combo;
  }

  private async validateItems(
    items: { productId: number; quantity: number }[],
  ): Promise<void> {
    const ids = items.map((i) => i.productId);

    const seen = new Set<number>();
    for (const id of ids) {
      if (seen.has(id)) {
        throw new BadRequestException(
          `Producto con id ${id} duplicado en el combo`,
        );
      }
      seen.add(id);
    }

    const found = await this.productRepository.findBy({ id: In(ids) });

    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((p) => p.id));
      const missing = ids.find((id) => !foundIds.has(id));
      throw new BadRequestException(`Producto con id ${missing} no encontrado`);
    }
  }

  private async validateCategoryExists(categoryId: number): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new BadRequestException(
        `Categoría con id ${categoryId} no encontrada`,
      );
    }
  }
}
