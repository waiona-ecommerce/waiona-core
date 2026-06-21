import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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

  const mockEntityManager = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  const mockCoupon = (overrides = {}): CouponEntity =>
    ({
      id: 1,
      code: 'DESCUENTO10',
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
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CouponUsageService>(CouponUsageService);
    usageRepo = module.get(getRepositoryToken(CouponUsageEntity));
    couponRepo = module.get(getRepositoryToken(CouponEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const dto = { code: 'DESCUENTO10', orderId: 1, userId: 1 };

    it('should create a usage and increment usageCount inside the transaction', async () => {
      const usage = mockUsage();
      mockEntityManager.findOne
        .mockResolvedValueOnce(mockCoupon())
        .mockResolvedValueOnce(null);
      mockEntityManager.create.mockReturnValue(usage);
      mockEntityManager.save.mockResolvedValue(usage);

      const result = await service.create(dto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result.couponId).toBe(1);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(null);
      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if coupon not active yet', async () => {
      const future = new Date(Date.now() + 100000);
      mockEntityManager.findOne.mockResolvedValueOnce(
        mockCoupon({ startsAt: future }),
      );
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if coupon expired', async () => {
      const past = new Date(Date.now() - 1000);
      mockEntityManager.findOne.mockResolvedValueOnce(
        mockCoupon({ endsAt: past }),
      );
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if usage limit reached', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(
        mockCoupon({ usageLimit: 5, usageCount: 5 }),
      );
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if user already used the coupon', async () => {
      mockEntityManager.findOne
        .mockResolvedValueOnce(mockCoupon())
        .mockResolvedValueOnce(mockUsage());
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated usages', async () => {
      usageRepo.findAndCount.mockResolvedValue([[mockUsage()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
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
      await expect(service.findByCoupon(999)).rejects.toThrow(NotFoundException);
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
