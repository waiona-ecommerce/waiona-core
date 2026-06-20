import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { ComboService } from '../../../products/combos/services/combo.service';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../../products/combos/entities/combo-item.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';
import { CategoryEntity } from '../../../products/categories/entities/category.entity';
import { ProductPricingEntity } from '../../../pricing/entities/product-pricing.entity';

describe('ComboService', () => {
  let service: ComboService;

  const mockCategory = { id: 1, name: 'Combos' };

  const mockCombo = (overrides = {}): ComboEntity =>
    ({
      id: 1,
      name: 'Combo Coca x3',
      description: 'Tres Coca Cola',
      isActive: true,
      deletedAt: null,
      categoryId: 1,
      category: mockCategory,
      items: [
        { productId: 1, quantity: 3, product: { name: 'Coca Cola 500ml' } },
      ],
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ComboEntity;

  const mockEntityManager = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findBy: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  const mockComboRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    softDelete: jest.fn(),
  };
  const mockItemRepo = { find: jest.fn() };
  const mockProductRepo = { findOne: jest.fn(), findBy: jest.fn() };
  const mockCategoryRepo = { findOne: jest.fn() };
  const mockProductPricingRepo = { findBy: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComboService,
        { provide: getRepositoryToken(ComboEntity), useValue: mockComboRepo },
        {
          provide: getRepositoryToken(ComboItemEntity),
          useValue: mockItemRepo,
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: mockProductRepo,
        },
        {
          provide: getRepositoryToken(CategoryEntity),
          useValue: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(ProductPricingEntity),
          useValue: mockProductPricingRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ComboService>(ComboService);
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return paginated combos with category', async () => {
      mockComboRepo.findAndCount.mockResolvedValue([[mockCombo()], 1]);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].categoryName).toBe('Combos');
      expect(result.total).toBe(1);
    });

    it('should return empty page if no combos', async () => {
      mockComboRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('should return a combo by id', async () => {
      mockComboRepo.findOne.mockResolvedValue(mockCombo());

      const result = await service.findById(1);

      expect(result.id).toBe(1);
      expect(result.categoryName).toBe('Combos');
    });

    it('should throw NotFoundException if not found', async () => {
      mockComboRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a combo', async () => {
      const dto = {
        name: 'Combo',
        description: 'Desc',
        categoryId: 1,
        items: [{ productId: 1, quantity: 2 }],
      };
      const combo = mockCombo();

      mockCategoryRepo.findOne.mockResolvedValue({ id: 1 });
      mockEntityManager.findBy
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ productId: 1 }]);
      mockEntityManager.create.mockReturnValue(combo);
      mockEntityManager.save.mockResolvedValue(combo);
      mockEntityManager.findOne.mockResolvedValueOnce(combo);

      const result = await service.create(dto);

      expect(result.name).toBe('Combo Coca x3');
      expect(result.categoryName).toBe('Combos');
    });

    it('should throw BadRequestException for duplicate productId', async () => {
      const dto = {
        name: 'Combo',
        description: 'Desc',
        categoryId: 1,
        items: [
          { productId: 1, quantity: 1 },
          { productId: 1, quantity: 2 },
        ],
      };

      mockCategoryRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if product not found', async () => {
      const dto = {
        name: 'Combo',
        description: 'Desc',
        categoryId: 1,
        items: [{ productId: 99, quantity: 1 }],
      };

      mockCategoryRepo.findOne.mockResolvedValue({ id: 1 });
      mockEntityManager.findBy.mockResolvedValueOnce([]);

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if product has no pricing', async () => {
      const dto = {
        name: 'Combo',
        description: 'Desc',
        categoryId: 1,
        items: [{ productId: 1, quantity: 2 }],
      };

      mockCategoryRepo.findOne.mockResolvedValue({ id: 1 });
      mockEntityManager.findBy
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([]);

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a combo', async () => {
      const dto = { name: 'Nuevo nombre', categoryId: 1 };
      const combo = mockCombo();

      mockCategoryRepo.findOne.mockResolvedValue({ id: 1 });
      mockEntityManager.findOne
        .mockResolvedValueOnce(combo)
        .mockResolvedValueOnce(mockCombo({ name: 'Nuevo nombre' }));
      mockEntityManager.merge.mockReturnValue(combo);
      mockEntityManager.save.mockResolvedValue(combo);

      const result = await service.update(1, dto);

      expect(result.name).toBe('Nuevo nombre');
      expect(result.categoryName).toBe('Combos');
    });

    it('should replace items if dto.items is provided', async () => {
      const dto = { items: [{ productId: 2, quantity: 1 }] };
      const combo = mockCombo();
      const updated = mockCombo({
        items: [{ productId: 2, quantity: 1, product: { name: 'Sprite' } }],
      });

      mockEntityManager.findOne
        .mockResolvedValueOnce(combo)
        .mockResolvedValueOnce(updated);
      mockEntityManager.findBy
        .mockResolvedValueOnce([{ id: 2 }])
        .mockResolvedValueOnce([{ productId: 2 }]);
      mockEntityManager.merge.mockReturnValue(combo);
      mockEntityManager.save.mockResolvedValue(combo);
      mockEntityManager.softDelete.mockResolvedValue({});

      const result = await service.update(1, dto);

      expect(mockEntityManager.softDelete).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if combo not found', async () => {
      mockCategoryRepo.findOne.mockResolvedValue({ id: 1 });
      mockEntityManager.findOne.mockResolvedValue(null);

      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // delete
  // ==========================

  describe('delete', () => {
    it('should soft delete a combo', async () => {
      const combo = mockCombo();

      mockEntityManager.findOne.mockResolvedValue(combo);
      mockEntityManager.softDelete.mockResolvedValue({} as any);

      await service.delete(1);

      expect(mockEntityManager.softDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
