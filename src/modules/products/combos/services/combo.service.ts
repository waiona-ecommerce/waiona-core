import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { ComboEntity } from '../entities/combo.entity';
import { ComboItemEntity } from '../entities/combo-item.entity';
import { ProductEntity } from '../../product/entities/product.entity';

import { CreateComboDto } from '../dto/create-combo.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { ComboResponseDto } from '../dto/combo-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class ComboService {

  constructor(
    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,

    @InjectRepository(ComboItemEntity)
    private readonly comboItemRepository: Repository<ComboItemEntity>,

    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<ComboResponseDto>> {

    const [combos, total] = await this.comboRepository.findAndCount({
      relations: ['category', 'items', 'items.product'], // 🔥 agrega category
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      combos.map(combo => new ComboResponseDto(combo)),
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

    return this.dataSource.transaction(async manager => {

      await this.validateItems(dto.items);

      const combo = manager.create(ComboEntity, {
        name:        dto.name,
        description: dto.description,
        isActive:    dto.isActive ?? true,
        categoryId:  dto.categoryId, // 🔥 agrega categoryId
      });

      const savedCombo = await manager.save(combo);

      const items = dto.items.map(item =>
        manager.create(ComboItemEntity, {
          comboId:   savedCombo.id,
          productId: item.productId,
          quantity:  item.quantity,
        }),
      );

      await manager.save(items);

      // 🔥 recarga con category para tener categoryName en la respuesta
      const fullCombo = await manager.findOne(ComboEntity, {
        where: { id: savedCombo.id },
        relations: ['category', 'items', 'items.product'],
      });

      return new ComboResponseDto(fullCombo!);
    });
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, dto: UpdateComboDto): Promise<ComboResponseDto> {

    return this.dataSource.transaction(async manager => {

      const combo = await manager.findOne(ComboEntity, {
        where: { id },
      });

      if (!combo) {
        throw new NotFoundException(`Combo with id ${id} not found`);
      }

      manager.merge(ComboEntity, combo, {
        name:        dto.name        ?? combo.name,
        description: dto.description ?? combo.description,
        isActive:    dto.isActive    ?? combo.isActive,
        categoryId:  dto.categoryId  ?? combo.categoryId, // 🔥 agrega categoryId
      });

      await manager.save(combo);

      if (dto.items) {

        await this.validateItems(dto.items);

        await manager.delete(ComboItemEntity, { comboId: combo.id });

        const newItems = dto.items.map(item =>
          manager.create(ComboItemEntity, {
            comboId:   combo.id,
            productId: item.productId,
            quantity:  item.quantity,
          }),
        );

        await manager.save(newItems);
      }

      // 🔥 recarga con category para tener categoryName actualizado
      const fullCombo = await manager.findOne(ComboEntity, {
        where: { id: combo.id },
        relations: ['category', 'items', 'items.product'],
      });

      return new ComboResponseDto(fullCombo!);
    });
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async delete(id: number): Promise<void> {

    const combo = await this.comboRepository.findOne({
      where: { id },
    });

    if (!combo) {
      throw new NotFoundException(`Combo with id ${id} not found`);
    }

    await this.comboRepository.softDelete(combo.id);
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findOne(id: number): Promise<ComboEntity> {

    const combo = await this.comboRepository.findOne({
      where: { id },
      relations: ['category', 'items', 'items.product'], // 🔥 agrega category
    });

    if (!combo) {
      throw new NotFoundException(`Combo with id ${id} not found`);
    }

    return combo;
  }

  private async validateItems(
    items: { productId: number; quantity: number }[],
  ): Promise<void> {

    const uniqueIds = new Set<number>();

    for (const item of items) {

      if (uniqueIds.has(item.productId)) {
        throw new BadRequestException(
          `Duplicate productId ${item.productId} in combo`,
        );
      }

      uniqueIds.add(item.productId);

      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });

      if (!product) {
        throw new BadRequestException(
          `Product with id ${item.productId} not found`,
        );
      }
    }
  }
}
