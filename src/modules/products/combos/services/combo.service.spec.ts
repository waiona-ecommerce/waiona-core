import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { ComboService } from '../../../products/combos/services/combo.service';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';
import { ComboImageEntity } from '../../../products/combo-images/entities/combo-image.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';
import { CategoryEntity } from '../../../products/categories/entities/category.entity';
import { ProductPricingEntity } from '../../../pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from '../../../pricing/entities/combo-pricing.entity';
import { DiscountComboTargetEntity } from '../../../discounts/discount-combo-target/entities/discount-combo-target.entity';
import { CouponComboTargetEntity } from '../../../coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { OrderItemEntity } from '../../../orders/entities/order-item.entity';

const mockCountRepo = () => ({ count: jest.fn() });

describe('ComboService', () => {
  let service: ComboService;

  let comboImageRepository: jest.Mocked<{ count: jest.Mock }>;
  let comboPricingRepository: jest.Mocked<{ count: jest.Mock }>;
  let discountComboTargetRepository: jest.Mocked<{ count: jest.Mock }>;
  let couponComboTargetRepository: jest.Mocked<{ count: jest.Mock }>;
  let orderItemRepository: jest.Mocked<{ count: jest.Mock }>;

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
  };
  const mockProductRepo = { findOne: jest.fn(), findBy: jest.fn() };
  const mockCategoryRepo = { findOne: jest.fn() };
  const mockProductPricingRepo = { findBy: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComboService,
        { provide: getRepositoryToken(ComboEntity), useValue: mockComboRepo },
        {
          provide: getRepositoryToken(ComboImageEntity),
          useFactory: mockCountRepo,
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
        {
          provide: getRepositoryToken(ComboPricingEntity),
          useFactory: mockCountRepo,
        },
        {
          provide: getRepositoryToken(DiscountComboTargetEntity),
          useFactory: mockCountRepo,
        },
        {
          provide: getRepositoryToken(CouponComboTargetEntity),
          useFactory: mockCountRepo,
        },
        {
          provide: getRepositoryToken(OrderItemEntity),
          useFactory: mockCountRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ComboService>(ComboService);
    comboImageRepository = module.get(getRepositoryToken(ComboImageEntity));
    comboPricingRepository = module.get(getRepositoryToken(ComboPricingEntity));
    discountComboTargetRepository = module.get(
      getRepositoryToken(DiscountComboTargetEntity),
    );
    couponComboTargetRepository = module.get(
      getRepositoryToken(CouponComboTargetEntity),
    );
    orderItemRepository = module.get(getRepositoryToken(OrderItemEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // helper: mockea todos los count de asociaciones en 0
  const mockAllCountsZero = () => {
    comboImageRepository.count.mockResolvedValue(0);
    comboPricingRepository.count.mockResolvedValue(0);
    discountComboTargetRepository.count.mockResolvedValue(0);
    couponComboTargetRepository.count.mockResolvedValue(0);
    orderItemRepository.count.mockResolvedValue(0);
  };

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

    it('should throw BadRequestException if product not found or inactive (isActive=false)', async () => {
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
    it('should soft delete combo and cascade items when no blocking associations', async () => {
      mockComboRepo.findOne.mockResolvedValue(mockCombo());
      mockAllCountsZero();
      mockEntityManager.softDelete.mockResolvedValue({});

      await service.delete(1);

      expect(mockEntityManager.softDelete).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if combo not found', async () => {
      mockComboRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it.each([
      ['imágenes', () => comboImageRepository.count.mockResolvedValue(2)],
      ['precio', () => comboPricingRepository.count.mockResolvedValue(1)],
      [
        'descuento',
        () => discountComboTargetRepository.count.mockResolvedValue(1),
      ],
      ['cupones', () => couponComboTargetRepository.count.mockResolvedValue(1)],
      ['órdenes', () => orderItemRepository.count.mockResolvedValue(3)],
    ])(
      'should throw ConflictException when combo has %s',
      async (_, setupMock) => {
        mockComboRepo.findOne.mockResolvedValue(mockCombo());
        mockAllCountsZero();
        setupMock();

        await expect(service.delete(1)).rejects.toThrow(ConflictException);
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
      },
    );
  });
});
