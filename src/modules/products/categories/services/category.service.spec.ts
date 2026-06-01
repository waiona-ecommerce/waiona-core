import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { CategoryService } from '../../../products/categories/services/category.service';
import { CategoryEntity } from '../../../products/categories/entities/category.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';
import { ShopCacheService } from '../../../../common/cache/shop-cache.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepository: jest.Mocked<Repository<CategoryEntity>>;
  let productRepository: jest.Mocked<Repository<ProductEntity>>;
  let comboRepository: jest.Mocked<Repository<ComboEntity>>;

  const mockCategoryRepo = () => ({
    findAndCount: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockCountRepo = () => ({ count: jest.fn() });
  const mockShopCacheService = { invalidate: jest.fn() };

  const mockCategory = (overrides = {}): CategoryEntity => ({
    id: 1,
    name: 'Bebidas',
    description: 'Bebidas en general',
    isActive: true,
    deletedAt: null,
    parentId: null,
    children: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(CategoryEntity),
          useFactory: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockCountRepo,
        },
        { provide: getRepositoryToken(ComboEntity), useFactory: mockCountRepo },
        { provide: ShopCacheService, useValue: mockShopCacheService },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categoryRepository = module.get(getRepositoryToken(CategoryEntity));
    productRepository = module.get(getRepositoryToken(ProductEntity));
    comboRepository = module.get(getRepositoryToken(ComboEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return paginated categories', async () => {
      categoryRepository.findAndCount.mockResolvedValue([[mockCategory()], 1]);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Bebidas');
      expect(result.total).toBe(1);
    });

    it('should return empty page', async () => {
      categoryRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('should return a category', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());

      const result = await service.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Bebidas');
    });

    it('should throw NotFoundException', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a category without parent', async () => {
      const entity = mockCategory();
      categoryRepository.create.mockReturnValue(entity);
      categoryRepository.save.mockResolvedValue(entity);

      const result = await service.create({
        name: 'Bebidas',
        isActive: true,
      });

      expect(result.name).toBe('Bebidas');
      expect(mockShopCacheService.invalidate).toHaveBeenCalled();
    });

    it('should throw BadRequestException if parentId not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Sub', parentId: 99 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a category', async () => {
      const entity = mockCategory();
      const updated = mockCategory({ name: 'Gaseosas' });

      categoryRepository.findOne.mockResolvedValue(entity);
      categoryRepository.merge.mockReturnValue(updated);
      categoryRepository.save.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Gaseosas' });

      expect(result.name).toBe('Gaseosas');
      expect(mockShopCacheService.invalidate).toHaveBeenCalled();
    });

    it('should throw BadRequestException if category is its own parent', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());

      await expect(service.update(1, { parentId: 1 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // delete
  // ==========================

  describe('delete', () => {
    it('should soft delete a category with no products or combos', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      productRepository.count.mockResolvedValue(0);
      comboRepository.count.mockResolvedValue(0);
      categoryRepository.softDelete.mockResolvedValue({} as any);

      await service.delete(1);

      expect(categoryRepository.softDelete).toHaveBeenCalledWith(1);
      expect(mockShopCacheService.invalidate).toHaveBeenCalled();
    });

    it('should throw ConflictException if category has active products', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      productRepository.count.mockResolvedValue(3);

      await expect(service.delete(1)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if category has active combos', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      productRepository.count.mockResolvedValue(0);
      comboRepository.count.mockResolvedValue(2);

      await expect(service.delete(1)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if category not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // getTree
  // ==========================

  describe('getTree', () => {
    it('should return tree with nested children', async () => {
      const root = mockCategory({ id: 1, parentId: null });
      const child = mockCategory({ id: 2, name: 'Gaseosas', parentId: 1 });

      categoryRepository.find.mockResolvedValue([root, child]);

      const result = await service.getTree();

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Gaseosas');
    });

    it('should return empty array if no categories', async () => {
      categoryRepository.find.mockResolvedValue([]);

      const result = await service.getTree();

      expect(result).toEqual([]);
    });
  });
});
