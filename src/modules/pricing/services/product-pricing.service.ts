import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PG_UNIQUE_VIOLATION } from 'src/common/constants/postgres-error-codes';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductPricingEntity } from '../entities/product-pricing.entity';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { MarginEntity } from 'src/modules/margins/entities/margin.entity';
import { CreateProductPricingDto } from '../dto/create-product-pricing.dto';
import { UpdateProductPricingDto } from '../dto/update-product-pricing.dto';
import { ProductPricingResponseDto } from '../dto/product-pricing-response.dto';

@Injectable()
export class ProductPricingService {

  constructor(
    @InjectRepository(ProductPricingEntity)
    private repo: Repository<ProductPricingEntity>,

    @InjectRepository(MarginEntity)
    private marginRepo: Repository<MarginEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateProductPricingDto): Promise<ProductPricingResponseDto> {

    const existing = await this.repo.findOne({
      where: { productId: dto.productId },
    });

    if (existing) {
      throw new BadRequestException('Product already has pricing');
    }

    const margin = dto.marginId
      ? await this.resolveMargin(dto.marginId)
      : null;

    const entity = this.repo.create({
      productId: dto.productId,
      currency: dto.currency,
      unitPrice: dto.unitPrice,
      margin,
    });

    try {
      const saved = await this.repo.save(entity);
      return new ProductPricingResponseDto(saved);
    } catch (err: any) {
      if (err.code === PG_UNIQUE_VIOLATION) throw new BadRequestException('Product already has pricing');
      throw err;
    }
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, dto: UpdateProductPricingDto): Promise<ProductPricingResponseDto> {

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
    return new ProductPricingResponseDto(saved);
  }

  // ==========================
  // FIND ALL
  // ==========================

  async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<ProductPricingResponseDto>> {
    const [entities, total] = await this.repo.findAndCount({
      relations: ['margin'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(entities.map((e) => new ProductPricingResponseDto(e)), total, page, limit);
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
      throw new NotFoundException('Product pricing not found');
    }

    return new ProductPricingResponseDto(entity);
  }

  // ==========================
  // REMOVE
  // ==========================

  async remove(id: number): Promise<void> {
    const entity = await this.findOneEntity(id);
    await this.repo.softDelete(entity.id);
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
      throw new NotFoundException('Product pricing not found');
    }

    return entity;
  }

  private async resolveMargin(marginId: number): Promise<MarginEntity> {
    const margin = await this.marginRepo.findOne({
      where: { id: marginId },
    });

    if (!margin) {
      throw new NotFoundException(`Margin with id ${marginId} not found`);
    }

    return margin;
  }
}