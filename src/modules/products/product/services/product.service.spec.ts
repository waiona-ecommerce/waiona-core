import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { ProductService } from './product.service';
import { ProductEntity } from '../entities/product.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { ProductMeasurementUnit } from '../enums/product-measurement-unit.enum';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: jest.Mocked<Repository<ProductEntity>>;
  let categoryRepository: jest.Mocked<Repository<CategoryEntity>>;

  const mockProductRepository = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockCategoryRepository = () => ({ findOne: jest.fn() });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockProductRepository,
        },
        {
          provide: getRepositoryToken(CategoryEntity),
          useFactory: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    productRepository = module.get(getRepositoryToken(ProductEntity));
    categoryRepository = module.get(getRepositoryToken(CategoryEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockCategory = { id: 1, name: 'Bebidas' };

  const mockProduct = (overrides = {}): ProductEntity =>
    ({
      id: 1,
      sku: 'COCA-500',
      name: 'Coca Cola 500ml',
      description: 'Gaseosa negra 500ml',
      isActive: true,
      deletedAt: null,
      categoryId: 1,
      category: mockCategory,
      measurementUnit: ProductMeasurementUnit.UNIT,
      measurementValue: 500,
      images: [],
      comboItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ProductEntity;

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return paginated products with category', async () => {
      productRepository.findAndCount.mockResolvedValue([[mockProduct()], 1]);

      const result = await service.findAll(1, 20);

      expect(productRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['category'],
        order: { name: 'ASC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Coca Cola 500ml');
      expect(result.data[0].categoryName).toBe('Bebidas');
      expect(result.total).toBe(1);
    });

    it('should return empty page if no products', async () => {
      productRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('should return a product by id', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct());

      const result = await service.findById(1);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category'],
      });
      expect(result.id).toBe(1);
      expect(result.categoryName).toBe('Bebidas');
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const createDto = {
      sku: 'sprite-500',
      name: 'Sprite 500ml',
      description: 'Gaseosa lima limón 500ml',
      categoryId: 1,
      measurementUnit: ProductMeasurementUnit.UNIT,
    };

    it('should create a product and return it with category', async () => {
      const savedProduct = mockProduct({
        id: 2,
        sku: 'SPRITE-500',
        name: 'Sprite 500ml',
      });

      categoryRepository.findOne.mockResolvedValue({ id: 1 } as any);

      productRepository.findOne
        .mockResolvedValueOnce(null) // SKU check — no existe
        .mockResolvedValueOnce(savedProduct); // recarga con relación

      productRepository.create.mockReturnValue(savedProduct);
      productRepository.save.mockResolvedValue(savedProduct);

      const result = await service.create(createDto);

      expect(productRepository.create).toHaveBeenCalledWith({
        ...createDto,
        sku: 'SPRITE-500',
        isActive: true,
      });
      expect(result.sku).toBe('SPRITE-500');
      expect(result.categoryName).toBe('Bebidas');
    });

    it('should throw ConflictException if SKU already exists', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 1 } as any);
      productRepository.findOne.mockResolvedValue(mockProduct());

      await expect(service.create(createDto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a product', async () => {
      const original = mockProduct();
      const updated = mockProduct({ name: 'Coca Cola 1L' });

      productRepository.findOne
        .mockResolvedValueOnce(original) // findOne inicial
        .mockResolvedValueOnce(updated); // recarga post-save

      productRepository.merge.mockReturnValue(updated);
      productRepository.save.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Coca Cola 1L' });

      expect(productRepository.merge).toHaveBeenCalledWith(original, {
        name: 'Coca Cola 1L',
      });
      expect(result.name).toBe('Coca Cola 1L');
    });

    it('should throw BadRequestException if new SKU already exists', async () => {
      const original = mockProduct({ sku: 'COCA-500' });
      const existingSku = mockProduct({ id: 2, sku: 'SPRITE-500' });

      productRepository.findOne
        .mockResolvedValueOnce(original) // findOne inicial
        .mockResolvedValueOnce(existingSku); // SKU check

      await expect(
        service.update(1, { sku: 'sprite-500' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { name: 'Test' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // delete
  // ==========================

  describe('delete', () => {
    it('should soft delete a product', async () => {
      const product = mockProduct();

      productRepository.findOne.mockResolvedValue(product);
      productRepository.softDelete.mockResolvedValue({} as any);

      await service.delete(1);

      expect(productRepository.softDelete).toHaveBeenCalledWith(product.id);
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
