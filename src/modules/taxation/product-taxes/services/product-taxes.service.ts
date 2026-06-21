import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

import { ProductTaxEntity } from '../entities/product-taxes.entity';
import { TaxEntity } from '../../taxes/entities/tax.entity';

import { CreateProductTaxDto } from '../dto/create-product-tax.dto';
import { UpdateProductTaxDto } from '../dto/update-product-tax.dto';
import { ProductTaxResponseDto } from '../dto/product-tax-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class ProductTaxesService {
  constructor(
    @InjectRepository(ProductTaxEntity)
    private readonly productTaxRepository: Repository<ProductTaxEntity>,

    @InjectRepository(TaxEntity)
    private readonly taxRepository: Repository<TaxEntity>,
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

    try {
      const saved = await this.productTaxRepository.save(productTax);
      return new ProductTaxResponseDto(await this.findEntity(saved.id));
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `El impuesto ${dto.taxId} ya está asignado a este producto`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // GET ALL BY PRODUCT
  // ==========================

  async findAll(
    productId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<ProductTaxResponseDto>> {
    const [productTaxes, total] = await this.productTaxRepository.findAndCount({
      where: { productId },
      relations: ['tax'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      productTaxes.map((pt) => new ProductTaxResponseDto(pt)),
      total,
      page,
      limit,
    );
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

    if (dto.taxId !== undefined && dto.taxId !== productTax.taxId) {
      const tax = await this.taxRepository.findOne({
        where: { id: dto.taxId },
      });

      if (!tax) {
        throw new NotFoundException(
          `Impuesto con id ${dto.taxId} no encontrado`,
        );
      }

      if (tax.isGlobal) {
        throw new BadRequestException(
          'Un impuesto global no puede asignarse a un producto específico',
        );
      }

      const duplicate = await this.productTaxRepository.findOne({
        where: { productId: productTax.productId, taxId: dto.taxId },
      });

      if (duplicate) {
        throw new ConflictException(
          `El impuesto ${dto.taxId} ya está asignado a este producto`,
        );
      }
    }

    const merged = this.productTaxRepository.merge(productTax, dto);
    try {
      const updated = await this.productTaxRepository.save(merged);
      return new ProductTaxResponseDto(await this.findEntity(updated.id));
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `El impuesto ${dto.taxId} ya está asignado a este producto`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async remove(id: number): Promise<void> {
    const productTax = await this.findEntity(id);
    await this.productTaxRepository.softDelete(productTax.id);
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findEntity(id: number): Promise<ProductTaxEntity> {
    const entity = await this.productTaxRepository.findOne({
      where: { id },
      relations: ['tax'],
    });
    if (!entity)
      throw new NotFoundException(
        `Impuesto de producto con id ${id} no encontrado`,
      );
    return entity;
  }
}
