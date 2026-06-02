import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductEntity } from '../entities/product.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
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
      where: {
        sku: dto.sku,
      },
    });

    if (existingSku) {
      throw new ConflictException(
        `Ya existe un producto con el SKU ${dto.sku}`,
      );
    }

    const product = this.productRepository.create({
      ...dto,
      sku: dto.sku.toUpperCase(),
      isActive: dto.isActive ?? true,
    });

    const saved = await this.productRepository.save(product);

    return new ProductResponseDto(await this.findOne(saved.id));
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
        where: {
          sku: changes.sku,
        },
      });

      if (existingSku) {
        throw new ConflictException(
          `Ya existe un producto con el SKU ${changes.sku}`,
        );
      }

      changes.sku = changes.sku.toUpperCase();
    }

    const merged = this.productRepository.merge(product, changes);

    await this.productRepository.save(merged);
    return new ProductResponseDto(await this.findOne(merged.id));
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
