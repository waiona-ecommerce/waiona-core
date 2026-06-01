import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PG_UNIQUE_VIOLATION } from '../../../common/constants/postgres-error-codes';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductPricingEntity } from '../entities/product-pricing.entity';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { MarginEntity } from '../../margins/entities/margin.entity';
import { CreateProductPricingDto } from '../dto/create-product-pricing.dto';
import { UpdateProductPricingDto } from '../dto/update-product-pricing.dto';
import { ProductPricingResponseDto } from '../dto/product-pricing-response.dto';
import { ShopCacheService } from '../../../common/cache/shop-cache.service';

@Injectable()
export class ProductPricingService {
  constructor(
    @InjectRepository(ProductPricingEntity)
    private repo: Repository<ProductPricingEntity>,

    @InjectRepository(MarginEntity)
    private marginRepo: Repository<MarginEntity>,

    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    dto: CreateProductPricingDto,
  ): Promise<ProductPricingResponseDto> {
    const existing = await this.repo.findOne({
      where: { productId: dto.productId },
    });

    if (existing) {
      throw new ConflictException('El producto ya tiene un pricing asignado');
    }

    const margin = dto.marginId ? await this.resolveMargin(dto.marginId) : null;

    const entity = this.repo.create({
      productId: dto.productId,
      currency: dto.currency,
      unitPrice: dto.unitPrice,
      margin,
    });

    try {
      const saved = await this.repo.save(entity);
      void this.shopCacheService.invalidate();
      return new ProductPricingResponseDto(saved);
    } catch (err: any) {
      if (err.code === PG_UNIQUE_VIOLATION)
        throw new ConflictException('El producto ya tiene un pricing asignado');
      throw err;
    }
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateProductPricingDto,
  ): Promise<ProductPricingResponseDto> {
    const entity = await this.findOneEntity(id);

    if (dto.marginId !== undefined) {
      entity.margin = dto.marginId
        ? await this.resolveMargin(dto.marginId)
        : null;
    }

    Object.assign(entity, {
      currency: dto.currency ?? entity.currency,
      unitPrice: dto.unitPrice ?? entity.unitPrice,
    });

    const saved = await this.repo.save(entity);
    void this.shopCacheService.invalidate();
    return new ProductPricingResponseDto(saved);
  }

  // ==========================
  // FIND ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<ProductPricingResponseDto>> {
    const [entities, total] = await this.repo.findAndCount({
      relations: ['margin'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      entities.map((e) => new ProductPricingResponseDto(e)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // FIND ONE
  // ==========================

  async findOne(id: number): Promise<ProductPricingResponseDto> {
    const entity = await this.findOneEntity(id);
    return new ProductPricingResponseDto(entity);
  }

  // ==========================
  // FIND BY PRODUCT
  // ==========================

  async findByProduct(productId: number): Promise<ProductPricingResponseDto> {
    const entity = await this.repo.findOne({
      where: { productId },
      relations: ['margin'],
    });

    if (!entity) {
      throw new NotFoundException('Pricing de producto no encontrado');
    }

    return new ProductPricingResponseDto(entity);
  }

  // ==========================
  // REMOVE
  // ==========================

  async remove(id: number): Promise<void> {
    const entity = await this.findOneEntity(id);
    await this.repo.softDelete(entity.id);
    void this.shopCacheService.invalidate();
  }

  // ==========================
  // HELPERS
  // ==========================

  private async findOneEntity(id: number): Promise<ProductPricingEntity> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: ['margin'],
    });

    if (!entity) {
      throw new NotFoundException('Pricing de producto no encontrado');
    }

    return entity;
  }

  private async resolveMargin(marginId: number): Promise<MarginEntity> {
    const margin = await this.marginRepo.findOne({
      where: { id: marginId },
    });

    if (!margin) {
      throw new NotFoundException(`Margen con id ${marginId} no encontrado`);
    }

    return margin;
  }
}
