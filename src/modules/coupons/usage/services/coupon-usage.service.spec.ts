import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CouponUsageService } from '../../../coupons/usage/services/coupon-usage.service';
import { CouponUsageEntity } from '../../../coupons/usage/entities/coupon-usage.entity';
import { CouponEntity } from '../../../coupons/coupon/entities/coupon.entity';
import { UserEntity } from '../../../users/entities/user.entity';

describe('CouponUsageService', () => {
  let service: CouponUsageService;
  let usageRepo: any;
  let couponRepo: any;
  let userRepo: any;

  const mockUsageRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  });
  const mockCouponRepo = () => ({ findOne: jest.fn() });
  const mockUserRepo = () => ({ findOne: jest.fn() });

  // manager de la transacción del caller (OrdersService) — validateAndComputeDiscount,
  // recordUsage y releaseUsage reciben este manager por parámetro, nunca abren su propia transacción.
  const mockManager: any = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockCoupon = (overrides = {}): CouponEntity =>
    ({
      id: 1,
      code: 'DESCUENTO10',
      value: 10,
      isGlobal: true,
      usageLimit: 100,
      usageCount: 0,
      startsAt: null,
      endsAt: null,
      deletedAt: null,
      ...overrides,
    }) as unknown as CouponEntity;

  const mockUsage = (overrides = {}) => ({
    id: 1,
    couponId: 1,
    orderId: 1,
    userId: 1,
    appliedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockUser = (overrides = {}) => ({
    id: 1,
    email: 'user@test.com',
    deletedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponUsageService,
        {
          provide: getRepositoryToken(CouponUsageEntity),
          useFactory: mockUsageRepo,
        },
        {
          provide: getRepositoryToken(CouponEntity),
          useFactory: mockCouponRepo,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useFactory: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<CouponUsageService>(CouponUsageService);
    usageRepo = module.get(getRepositoryToken(CouponUsageEntity));
    couponRepo = module.get(getRepositoryToken(CouponEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
    Object.values(mockManager).forEach((fn: any) => fn.mockReset());
  });

  describe('validateAndComputeDiscount', () => {
    const items = [{ productId: 1, subtotal: 653.4 }];

    it('should throw NotFoundException if coupon not found', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.validateAndComputeDiscount('NOEXISTE', 1, items, mockManager),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if coupon is not active yet', async () => {
      const future = new Date(Date.now() + 100_000);
      mockManager.findOne.mockResolvedValueOnce(
        mockCoupon({ startsAt: future }),
      );

      await expect(
        service.validateAndComputeDiscount('DESC10', 1, items, mockManager),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if coupon is expired', async () => {
      const past = new Date(Date.now() - 1000);
      mockManager.findOne.mockResolvedValueOnce(mockCoupon({ endsAt: past }));

      await expect(
        service.validateAndComputeDiscount('DESC10', 1, items, mockManager),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if usage limit is reached', async () => {
      mockManager.findOne.mockResolvedValueOnce(
        mockCoupon({ usageLimit: 5, usageCount: 5 }),
      );

      await expect(
        service.validateAndComputeDiscount('DESC10', 1, items, mockManager),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if the user already used the coupon', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon())
        .mockResolvedValueOnce({ id: 9 }); // alreadyUsed

      await expect(
        service.validateAndComputeDiscount('DESC10', 1, items, mockManager),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if a non-global coupon has no matching target', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon({ isGlobal: false }))
        .mockResolvedValueOnce(null); // sin uso previo
      mockManager.find.mockResolvedValueOnce([]); // sin targets

      await expect(
        service.validateAndComputeDiscount('DESC10', 1, items, mockManager),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not enforce a usage limit when usageLimit is null', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(
          mockCoupon({ isGlobal: true, value: 10, usageLimit: null }),
        )
        .mockResolvedValueOnce(null);

      const result = await service.validateAndComputeDiscount(
        'DESC10',
        1,
        items,
        mockManager,
      );

      expect(result.discount).toBeCloseTo(65.34);
    });

    it('should return the discount for a global coupon over all items', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon({ isGlobal: true, value: 10 }))
        .mockResolvedValueOnce(null);

      const result = await service.validateAndComputeDiscount(
        'DESC10',
        1,
        items,
        mockManager,
      );

      expect(result.discount).toBeCloseTo(65.34);
      expect(mockManager.find).not.toHaveBeenCalled();
    });

    it('should return the discount for a non-global coupon targeting a specific product', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon({ isGlobal: false, value: 10 }))
        .mockResolvedValueOnce(null);
      mockManager.find.mockResolvedValueOnce([{ couponId: 1, productId: 1 }]);

      const result = await service.validateAndComputeDiscount(
        'DESC10',
        1,
        items,
        mockManager,
      );

      expect(result.discount).toBeCloseTo(65.34);
    });

    it('should return the discount for a non-global coupon targeting a specific combo', async () => {
      const comboItems = [{ comboId: 1, subtotal: 653.4 }];
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon({ isGlobal: false, value: 10 }))
        .mockResolvedValueOnce(null);
      mockManager.find.mockResolvedValueOnce([{ couponId: 1, comboId: 1 }]);

      const result = await service.validateAndComputeDiscount(
        'DESC10',
        1,
        comboItems,
        mockManager,
      );

      expect(result.discount).toBeCloseTo(65.34);
    });

    it('should only discount the eligible items of a non-global coupon', async () => {
      const mixedItems = [
        { productId: 1, subtotal: 653.4 },
        { productId: 2, subtotal: 653.4 },
      ];
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon({ isGlobal: false, value: 10 }))
        .mockResolvedValueOnce(null);
      mockManager.find.mockResolvedValueOnce([{ couponId: 1, productId: 1 }]); // solo productId 1 es target

      const result = await service.validateAndComputeDiscount(
        'DESC10',
        1,
        mixedItems,
        mockManager,
      );

      // 10% solo sobre 653.4 (el ítem elegible), no sobre 1306.8
      expect(result.discount).toBeCloseTo(65.34);
    });
  });

  describe('recordUsage', () => {
    it('should increment usageCount and create the usage row', async () => {
      const coupon = mockCoupon({ usageCount: 5 });
      mockManager.save.mockResolvedValue(undefined);
      mockManager.create.mockReturnValue({
        couponId: 1,
        userId: 1,
        orderId: 7,
      });

      await service.recordUsage(coupon, 1, 7, mockManager);

      expect(coupon.usageCount).toBe(6);
      expect(mockManager.save).toHaveBeenCalledWith(
        CouponEntity,
        expect.objectContaining({ usageCount: 6 }),
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        CouponUsageEntity,
        expect.objectContaining({ couponId: 1, userId: 1, orderId: 7 }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        CouponUsageEntity,
        expect.objectContaining({ couponId: 1, userId: 1, orderId: 7 }),
      );
    });
  });

  describe('releaseUsage', () => {
    it('should decrement usageCount and soft-delete the usage row', async () => {
      mockManager.findOne.mockResolvedValueOnce(
        mockCoupon({ id: 5, usageCount: 3 }),
      );
      mockManager.save.mockResolvedValue(undefined);
      mockManager.softDelete.mockResolvedValue(undefined);

      await service.releaseUsage(5, 7, mockManager);

      expect(mockManager.save).toHaveBeenCalledWith(
        CouponEntity,
        expect.objectContaining({ usageCount: 2 }),
      );
      expect(mockManager.softDelete).toHaveBeenCalledWith(CouponUsageEntity, {
        couponId: 5,
        orderId: 7,
      });
    });

    it('should not go below zero when usageCount is already 0', async () => {
      mockManager.findOne.mockResolvedValueOnce(
        mockCoupon({ id: 5, usageCount: 0 }),
      );
      mockManager.save.mockResolvedValue(undefined);

      await service.releaseUsage(5, 7, mockManager);

      expect(mockManager.save).toHaveBeenCalledWith(
        CouponEntity,
        expect.objectContaining({ usageCount: 0 }),
      );
    });

    it('should do nothing if the coupon no longer exists', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);

      await service.releaseUsage(999, 7, mockManager);

      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockManager.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated usages', async () => {
      usageRepo.findAndCount.mockResolvedValue([[mockUsage()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
    });

    it('should return empty data array', async () => {
      usageRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findByCoupon', () => {
    it('should return usages by couponId', async () => {
      couponRepo.findOne.mockResolvedValue(mockCoupon());
      usageRepo.find.mockResolvedValue([mockUsage()]);
      const result = await service.findByCoupon(1);
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      couponRepo.findOne.mockResolvedValue(null);
      await expect(service.findByCoupon(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUser', () => {
    it('should return usages by userId', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      usageRepo.find.mockResolvedValue([mockUsage()]);
      const result = await service.findByUser(1);
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findByUser(999)).rejects.toThrow(NotFoundException);
    });
  });
});
