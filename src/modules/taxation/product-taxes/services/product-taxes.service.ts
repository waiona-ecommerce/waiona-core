import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductTaxEntity } from '../entities/product-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';

import { CreateProductTaxDto } from '../dto/create-product-tax.dto';
import { UpdateProductTaxDto } from '../dto/update-product-tax.dto';
import { ProductTaxResponseDto } from '../dto/product-tax-response.dto';
import { ShopCacheService } from 'src/common/cache/shop-cache.service';

@Injectable()
export class ProductTaxesService {
  constructor(
    @InjectRepository(ProductTaxEntity)
    private readonly productTaxRepository: Repository<ProductTaxEntity>,

    @InjectRepository(TaxEntity)
    private readonly taxRepository: Repository<TaxEntity>,

    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    dto: CreateProductTaxDto & { productId: number },
  ): Promise<ProductTaxResponseDto> {
    const tax = await this.taxRepository.findOne({
      where: { id: dto.taxId },
    });

    if (!tax) {
      throw new NotFoundException(`Impuesto con id ${dto.taxId} no encontrado`);
    }

    if (tax.isGlobal) {
      throw new BadRequestException(
        'Un impuesto global no puede asignarse a un producto específico',
      );
    }

    const existing = await this.productTaxRepository.findOne({
      where: { productId: dto.productId, taxId: dto.taxId },
    });
    if (existing) {
      throw new ConflictException(
        `El impuesto ${dto.taxId} ya está asignado a este producto`,
      );
    }

    const productTax = this.productTaxRepository.create({
      productId: dto.productId,
      taxId: dto.taxId,
    });

    const saved = await this.productTaxRepository.save(productTax);
    void this.shopCacheService.invalidate();
    return new ProductTaxResponseDto(saved);
  }

  // ==========================
  // GET ALL BY PRODUCT
  // ==========================

  async findAll(productId: number): Promise<ProductTaxResponseDto[]> {
    const productTaxes = await this.productTaxRepository.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });

    return productTaxes.map((pt) => new ProductTaxResponseDto(pt));
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findOne(id: number): Promise<ProductTaxResponseDto> {
    return new ProductTaxResponseDto(await this.findEntity(id));
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateProductTaxDto,
  ): Promise<ProductTaxResponseDto> {
    const productTax = await this.findEntity(id);
    const merged = this.productTaxRepository.merge(productTax, dto);
    const updated = await this.productTaxRepository.save(merged);
    void this.shopCacheService.invalidate();
    return new ProductTaxResponseDto(updated);
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async remove(id: number): Promise<void> {
    const productTax = await this.findEntity(id);
    await this.productTaxRepository.softDelete(productTax.id);
    void this.shopCacheService.invalidate();
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findEntity(id: number): Promise<ProductTaxEntity> {
    const entity = await this.productTaxRepository.findOne({ where: { id } });
    if (!entity)
      throw new NotFoundException(
        `Impuesto de producto con id ${id} no encontrado`,
      );
    return entity;
  }
}
