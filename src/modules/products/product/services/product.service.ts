import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductEntity } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class ProductService {

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<ProductResponseDto>> {

    const [products, total] = await this.productRepository.findAndCount({
      relations: ['category'], // 🔥 para exponer categoryName en la respuesta
      order: {
        name: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      products.map(product => new ProductResponseDto(product)),
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

  async create(
    dto: CreateProductDto,
  ): Promise<ProductResponseDto> {

    // 🔥 Validar SKU único
    const existingSku = await this.productRepository.findOne({
      where: {
        sku: dto.sku,
      },
    });

    if (existingSku) {
      throw new BadRequestException(
        `Product with SKU ${dto.sku} already exists`,
      );
    }

    const product = this.productRepository.create({
      ...dto,
      sku: dto.sku.toUpperCase(),
      isActive: dto.isActive ?? true,
    });

    const saved = await this.productRepository.save(product);

    // 🔥 recargar con relación para tener categoryName en la respuesta
    return new ProductResponseDto(
      await this.findOne(saved.id),
    );
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    changes: UpdateProductDto,
  ): Promise<ProductResponseDto> {

    const product = await this.findOne(id);

    // 🔥 Validar SKU si se quiere cambiar
    if (changes.sku && changes.sku !== product.sku) {

      const existingSku = await this.productRepository.findOne({
        where: {
          sku: changes.sku,
        },
      });

      if (existingSku) {
        throw new BadRequestException(
          `Product with SKU ${changes.sku} already exists`,
        );
      }

      changes.sku = changes.sku.toUpperCase();
    }

    const merged = this.productRepository.merge(product, changes);

    await this.productRepository.save(merged);

    // 🔥 recargar con relación para tener categoryName actualizado
    return new ProductResponseDto(
      await this.findOne(merged.id),
    );
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  async delete(id: number): Promise<void> {

    const product = await this.findOne(id);

    await this.productRepository.softDelete(product.id);
  }

  // ==========================
  // PRIVATE FIND ONE
  // ==========================

  private async findOne(id: number): Promise<ProductEntity> {

    const product = await this.productRepository.findOne({
      where: {
        id,
      },
      relations: ['category'], // 🔥 siempre con categoría
    });

    if (!product) {
      throw new NotFoundException(
        `Product with id ${id} not found`,
      );
    }

    return product;
  }
}
