import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

import { ProductEntity } from '../entities/product.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { ComboItemEntity } from '../../combos/entities/combo-item.entity';
import { ProductImageEntity } from '../../product-images/entities/product-image.entity';
import { ProductPricingEntity } from '../../../pricing/entities/product-pricing.entity';
import { StockItemEntity } from '../../../stocks/stock-item/entities/stock-item.entity';
import { ProductTaxEntity } from '../../../taxation/product-taxes/entities/product-taxes.entity';
import { DiscountProductTargetEntity } from '../../../discounts/discount-product-target/entities/discount-product-target.entity';
import { CouponProductTargetEntity } from '../../../coupons/coupon-product-target/entities/coupon-product-target.entity';
import { OrderItemEntity } from '../../../orders/entities/order-item.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(ComboItemEntity)
    private readonly comboItemRepository: Repository<ComboItemEntity>,

    @InjectRepository(ProductImageEntity)
    private readonly productImageRepository: Repository<ProductImageEntity>,

    @InjectRepository(ProductPricingEntity)
    private readonly productPricingRepository: Repository<ProductPricingEntity>,

    @InjectRepository(StockItemEntity)
    private readonly stockItemRepository: Repository<StockItemEntity>,

    @InjectRepository(ProductTaxEntity)
    private readonly productTaxRepository: Repository<ProductTaxEntity>,

    @InjectRepository(DiscountProductTargetEntity)
    private readonly discountProductTargetRepository: Repository<DiscountProductTargetEntity>,

    @InjectRepository(CouponProductTargetEntity)
    private readonly couponProductTargetRepository: Repository<CouponProductTargetEntity>,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const [products, total] = await this.productRepository.findAndCount({
      relations: ['category'],
      order: {
        name: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      products.map((product) => new ProductResponseDto(product)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findById(id: number): Promise<ProductResponseDto> {
    const product = await this.findOne(id);

    return new ProductResponseDto(product);
  }

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    await this.validateCategoryExists(dto.categoryId);

    const existingSku = await this.productRepository.findOne({
      where: { sku: dto.sku },
    });

    if (existingSku) {
      throw new ConflictException(
        `Ya existe un producto con el SKU ${dto.sku}`,
      );
    }

    const product = this.productRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });

    try {
      const saved = await this.productRepository.save(product);
      return new ProductResponseDto(await this.findOne(saved.id));
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe un producto con el SKU ${dto.sku}`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    changes: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.findOne(id);

    if (changes.categoryId !== undefined) {
      await this.validateCategoryExists(changes.categoryId);
    }

    if (changes.sku && changes.sku !== product.sku) {
      const existingSku = await this.productRepository.findOne({
        where: { sku: changes.sku },
      });

      if (existingSku) {
        throw new ConflictException(
          `Ya existe un producto con el SKU ${changes.sku}`,
        );
      }
    }

    const merged = this.productRepository.merge(product, changes);

    try {
      await this.productRepository.save(merged);
      return new ProductResponseDto(await this.findOne(merged.id));
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe un producto con el SKU ${changes.sku}`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async delete(id: number): Promise<void> {
    await this.findOne(id);

    const [
      imageCount,
      pricingCount,
      stockCount,
      taxCount,
      discountCount,
      couponCount,
      orderItemCount,
      comboItemCount,
    ] = await Promise.all([
      this.productImageRepository.count({ where: { productId: id } }),
      this.productPricingRepository.count({ where: { productId: id } }),
      this.stockItemRepository.count({ where: { productId: id } }),
      this.productTaxRepository.count({ where: { productId: id } }),
      this.discountProductTargetRepository.count({ where: { productId: id } }),
      this.couponProductTargetRepository.count({ where: { productId: id } }),
      this.orderItemRepository.count({ where: { productId: id } }),
      this.comboItemRepository.count({ where: { productId: id } }),
    ]);

    const blocking: string[] = [];
    if (imageCount > 0) blocking.push(`${imageCount} imagen(es)`);
    if (pricingCount > 0) blocking.push(`precio configurado`);
    if (stockCount > 0) blocking.push(`${stockCount} ítem(s) de stock`);
    if (taxCount > 0) blocking.push(`${taxCount} impuesto(s) asignado(s)`);
    if (discountCount > 0) blocking.push(`un descuento asignado`);
    if (couponCount > 0) blocking.push(`${couponCount} cupón(es) asignado(s)`);
    if (orderItemCount > 0)
      blocking.push(`${orderItemCount} orden(es) que lo incluyen`);
    if (comboItemCount > 0)
      blocking.push(`${comboItemCount} combo(s) que lo incluyen`);

    if (blocking.length > 0) {
      throw new ConflictException(
        `No se puede eliminar el producto: tiene ${blocking.join(', ')}`,
      );
    }

    await this.productRepository.softDelete(id);
  }

  // ==========================
  // PRIVATE
  // ==========================

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

  private async findOne(id: number): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }

    return product;
  }
}
