import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  PG_UNIQUE_VIOLATION,
  PG_FK_VIOLATION,
} from '../../../common/constants/postgres-error-codes';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductPricingEntity } from '../entities/product-pricing.entity';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { CreateProductPricingDto } from '../dto/create-product-pricing.dto';
import { UpdateProductPricingDto } from '../dto/update-product-pricing.dto';
import { ProductPricingResponseDto } from '../dto/product-pricing-response.dto';

@Injectable()
export class ProductPricingService {
  constructor(
    @InjectRepository(ProductPricingEntity)
    private repo: Repository<ProductPricingEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    dto: CreateProductPricingDto,
  ): Promise<ProductPricingResponseDto> {
    if (dto.salePrice <= dto.unitPrice) {
      throw new BadRequestException(
        'El precio de venta debe ser mayor al precio de costo',
      );
    }

    const existing = await this.repo.findOne({
      where: { productId: dto.productId },
    });

    if (existing) {
      throw new ConflictException('El producto ya tiene un pricing asignado');
    }

    const entity = this.repo.create({
      productId: dto.productId,
      currency: dto.currency,
      unitPrice: dto.unitPrice,
      salePrice: dto.salePrice,
    });

    try {
      const saved = await this.repo.save(entity);
      return new ProductPricingResponseDto(saved);
    } catch (err: any) {
      if (err.code === PG_UNIQUE_VIOLATION)
        throw new ConflictException('El producto ya tiene un pricing asignado');
      if (err.code === PG_FK_VIOLATION)
        throw new NotFoundException(
          `Producto con id ${dto.productId} no encontrado`,
        );
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

    const effectiveUnitPrice = dto.unitPrice ?? Number(entity.unitPrice);
    const effectiveSalePrice = dto.salePrice ?? Number(entity.salePrice);

    if (effectiveSalePrice <= effectiveUnitPrice) {
      throw new BadRequestException(
        'El precio de venta debe ser mayor al precio de costo',
      );
    }

    Object.assign(entity, {
      currency: dto.currency ?? entity.currency,
      unitPrice: effectiveUnitPrice,
      salePrice: effectiveSalePrice,
    });

    const saved = await this.repo.save(entity);
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
    const entity = await this.repo.findOne({ where: { productId } });

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
  }

  // ==========================
  // HELPERS
  // ==========================

  private async findOneEntity(id: number): Promise<ProductPricingEntity> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException('Pricing de producto no encontrado');
    }

    return entity;
  }
}
