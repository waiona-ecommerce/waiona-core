import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductImageEntity } from '../entities/product-image.entity';
import { ProductEntity } from '../../product/entities/product.entity';

import { CreateProductImageDto } from '../dto/create-product-image.dto';
import { UpdateProductImageDto } from '../dto/update-product-image.dto';
import { UploadProductImageDto } from '../dto/upload-product-image.dto';
import { ProductImageResponseDto } from '../dto/product-image-response.dto';
import { StorageService } from '../../../storage/storage.service';

@Injectable()
export class ProductImageService {
  constructor(
    @InjectRepository(ProductImageEntity)
    private readonly productImageRepository: Repository<ProductImageEntity>,

    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    private readonly storageService: StorageService,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateProductImageDto): Promise<ProductImageResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Producto con id ${dto.productId} no encontrado`,
      );
    }

    const image = this.productImageRepository.create(dto);

    const saved = await this.productImageRepository.save(image);

    return new ProductImageResponseDto(saved);
  }

  // ==========================
  // GET ALL BY PRODUCT
  // ==========================

  async findByProduct(productId: number): Promise<ProductImageResponseDto[]> {
    const images = await this.productImageRepository.find({
      where: { productId },
      order: { position: 'ASC' },
    });

    return images.map((image) => new ProductImageResponseDto(image));
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findOne(id: number): Promise<ProductImageResponseDto> {
    return new ProductImageResponseDto(await this.findEntity(id));
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    const image = await this.findEntity(id);
    const merged = this.productImageRepository.merge(image, dto);
    const updated = await this.productImageRepository.save(merged);

    return new ProductImageResponseDto(updated);
  }

  // ==========================
  // UPLOAD (multipart → Cloudinary)
  // ==========================

  async uploadImage(
    file: Express.Multer.File,
    dto: UploadProductImageDto,
  ): Promise<ProductImageResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Producto con id ${dto.productId} no encontrado`,
      );
    }

    const { url, publicId } = await this.storageService.upload(
      file,
      'waiona/products',
    );

    const image = this.productImageRepository.create({
      productId: dto.productId,
      position: dto.position,
      url,
      publicId,
    });
    const saved = await this.productImageRepository.save(image);

    return new ProductImageResponseDto(saved);
  }

  // ==========================
  // DELETE (soft + Cloudinary)
  // ==========================

  async remove(id: number): Promise<void> {
    const image = await this.findEntity(id);
    if (image.publicId) {
      await this.storageService.delete(image.publicId);
    }
    await this.productImageRepository.softDelete(image.id);
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findEntity(id: number): Promise<ProductImageEntity> {
    const image = await this.productImageRepository.findOne({ where: { id } });
    if (!image)
      throw new NotFoundException(
        `Imagen de producto con id ${id} no encontrada`,
      );
    return image;
  }
}
