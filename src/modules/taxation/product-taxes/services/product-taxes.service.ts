import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductTaxEntity } from '../entities/product-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';

import { CreateProductTaxDto } from '../dto/create-product-tax.dto';
import { UpdateProductTaxDto } from '../dto/update-product-tax.dto';
import { ProductTaxResponseDto } from '../dto/product-tax-response.dto';

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

  async create(dto: CreateProductTaxDto & { productId: number }): Promise<ProductTaxResponseDto> {

    const tax = await this.taxRepository.findOne({
      where: { id: dto.taxId },
    });

    if (!tax) {
      throw new NotFoundException(`Tax with id ${dto.taxId} not found`);
    }

    if (tax.isGlobal) {
      throw new BadRequestException('A global tax cannot be assigned to a specific product');
    }

    const productTax = this.productTaxRepository.create({
      productId: dto.productId,
      taxId: dto.taxId,
    });

    const saved = await this.productTaxRepository.save(productTax);
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

    return productTaxes.map(pt => new ProductTaxResponseDto(pt));
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findOne(id: number): Promise<ProductTaxResponseDto> {
    const productTax = await this.productTaxRepository.findOne({
      where: { id },
    });

    if (!productTax) {
      throw new NotFoundException(`ProductTax with id ${id} not found`);
    }

    return new ProductTaxResponseDto(productTax);
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, dto: UpdateProductTaxDto): Promise<ProductTaxResponseDto> {
    const productTax = await this.productTaxRepository.findOne({
      where: { id },
    });

    if (!productTax) {
      throw new NotFoundException(`ProductTax with id ${id} not found`);
    }

    const merged = this.productTaxRepository.merge(productTax, dto);
    const updated = await this.productTaxRepository.save(merged);
    return new ProductTaxResponseDto(updated);
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async remove(id: number): Promise<void> {
    const productTax = await this.productTaxRepository.findOne({
      where: { id },
    });

    if (!productTax) {
      throw new NotFoundException(`ProductTax with id ${id} not found`);
    }

    await this.productTaxRepository.softDelete(productTax.id);
  }
}