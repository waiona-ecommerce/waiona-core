import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, EntityManager } from 'typeorm';

import { ComboEntity } from '../entities/combo.entity';
import { ComboItemEntity } from '../entities/combo-item.entity';
import { ComboImageEntity } from '../../combo-images/entities/combo-image.entity';
import { ProductEntity } from '../../product/entities/product.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { ProductPricingEntity } from '../../../pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from '../../../pricing/entities/combo-pricing.entity';
import { DiscountComboTargetEntity } from '../../../discounts/discount-combo-target/entities/discount-combo-target.entity';
import { CouponComboTargetEntity } from '../../../coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { OrderItemEntity } from '../../../orders/entities/order-item.entity';

import { CreateComboDto } from '../dto/create-combo.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { ComboResponseDto } from '../dto/combo-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class ComboService {
  constructor(
    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,

    @InjectRepository(ComboImageEntity)
    private readonly comboImageRepository: Repository<ComboImageEntity>,

    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(ProductPricingEntity)
    private readonly productPricingRepository: Repository<ProductPricingEntity>,

    @InjectRepository(ComboPricingEntity)
    private readonly comboPricingRepository: Repository<ComboPricingEntity>,

    @InjectRepository(DiscountComboTargetEntity)
    private readonly discountComboTargetRepository: Repository<DiscountComboTargetEntity>,

    @InjectRepository(CouponComboTargetEntity)
    private readonly couponComboTargetRepository: Repository<CouponComboTargetEntity>,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,

    private readonly dataSource: DataSource,
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

    const combo = await this.dataSource.transaction(async (manager) => {
      await this.validateItems(dto.items, manager);

      const entity = manager.create(ComboEntity, {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
      });

      const savedCombo = await manager.save(entity);

      const items = dto.items.map((item) =>
        manager.create(ComboItemEntity, {
          comboId: savedCombo.id,
          productId: item.productId,
          quantity: item.quantity,
        }),
      );

      await manager.save(items);

      return manager.findOne(ComboEntity, {
        where: { id: savedCombo.id },
        relations: ['category', 'items', 'items.product'],
      });
    });

    return new ComboResponseDto(combo!);
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, dto: UpdateComboDto): Promise<ComboResponseDto> {
    if (dto.categoryId !== undefined) {
      await this.validateCategoryExists(dto.categoryId);
    }

    const combo = await this.dataSource.transaction(async (manager) => {
      const entity = await manager.findOne(ComboEntity, {
        where: { id },
      });

      if (!entity) {
        throw new NotFoundException(`Combo con id ${id} no encontrado`);
      }

      manager.merge(ComboEntity, entity, {
        name: dto.name ?? entity.name,
        description: dto.description ?? entity.description,
        isActive: dto.isActive ?? entity.isActive,
        categoryId: dto.categoryId ?? entity.categoryId,
      });

      await manager.save(entity);

      if (dto.items) {
        await this.validateItems(dto.items, manager);

        await manager.softDelete(ComboItemEntity, { comboId: entity.id });

        const newItems = dto.items.map((item) =>
          manager.create(ComboItemEntity, {
            comboId: entity.id,
            productId: item.productId,
            quantity: item.quantity,
          }),
        );

        await manager.save(newItems);
      }

      return manager.findOne(ComboEntity, {
        where: { id: entity.id },
        relations: ['category', 'items', 'items.product'],
      });
    });

    return new ComboResponseDto(combo!);
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async delete(id: number): Promise<void> {
    const combo = await this.comboRepository.findOne({ where: { id } });

    if (!combo) {
      throw new NotFoundException(`Combo con id ${id} no encontrado`);
    }

    const [imageCount, pricingCount, discountCount, couponCount, orderCount] =
      await Promise.all([
        this.comboImageRepository.count({ where: { comboId: id } }),
        this.comboPricingRepository.count({ where: { comboId: id } }),
        this.discountComboTargetRepository.count({ where: { comboId: id } }),
        this.couponComboTargetRepository.count({ where: { comboId: id } }),
        this.orderItemRepository.count({ where: { comboId: id } }),
      ]);

    const blocking: string[] = [];
    if (imageCount > 0) blocking.push(`${imageCount} imagen(es)`);
    if (pricingCount > 0) blocking.push(`precio configurado`);
    if (discountCount > 0) blocking.push(`un descuento asignado`);
    if (couponCount > 0) blocking.push(`${couponCount} cupón(es) asignado(s)`);
    if (orderCount > 0)
      blocking.push(`${orderCount} orden(es) que lo incluyen`);

    if (blocking.length > 0) {
      throw new ConflictException(
        `No se puede eliminar el combo: tiene ${blocking.join(', ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.softDelete(ComboItemEntity, { comboId: id });
      await manager.softDelete(ComboEntity, id);
    });
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
    manager: EntityManager,
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

    const found = await manager.findBy(ProductEntity, {
      id: In(ids),
      isActive: true,
    });

    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((p) => p.id));
      const missing = ids.find((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Producto con id ${missing} no encontrado o inactivo`,
      );
    }

    const pricings = await manager.findBy(ProductPricingEntity, {
      productId: In(ids),
    });
    const pricedIds = new Set(pricings.map((p) => p.productId));
    if (pricedIds.size !== ids.length) {
      const missing = ids.find((id) => !pricedIds.has(id));
      throw new BadRequestException(
        `Producto con id ${missing} no tiene precio configurado`,
      );
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
