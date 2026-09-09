import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CouponProductTargetService } from '../../../coupons/coupon-product-target/services/coupon-product-target.service';
import { CouponProductTargetEntity } from '../../../coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponEntity } from '../../../coupons/coupon/entities/coupon.entity';

describe('CouponProductTargetService', () => {
  let service: CouponProductTargetService;

  const mockTargetRepo = () => ({
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockCouponRepo = () => ({ findOne: jest.fn() });

  // create() ahora corre dentro de una transacción con lock sobre el cupón
  const mockManager = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockManager)),
  };

  const mockCoupon = (overrides = {}) => ({
    id: 1,
    code: 'FIJO500',
    isGlobal: false,
    deletedAt: null,
    endsAt: null,
    usageLimit: null,
    usageCount: 0,
    ...overrides,
  });
  const mockTarget = (overrides = {}) => ({
    id: 1,
    couponId: 1,
    productId: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  const mockProduct = (overrides = {}) => ({
    id: 1,
    name: 'Producto A',
    isActive: true,
    ...overrides,
  });

  let targetRepo: any;
  let couponRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponProductTargetService,
        {
          provide: getRepositoryToken(CouponProductTargetEntity),
          useFactory: mockTargetRepo,
        },
        {
          provide: getRepositoryToken(CouponEntity),
          useFactory: mockCouponRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CouponProductTargetService>(
      CouponProductTargetService,
    );
    targetRepo = module.get(getRepositoryToken(CouponProductTargetEntity));
    couponRepo = module.get(getRepositoryToken(CouponEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
    Object.values(mockManager).forEach((fn) => fn.mockReset());
  });

  describe('create', () => {
    it('should create a product target', async () => {
      const target = mockTarget();
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon()) // coupon (locked)
        .mockResolvedValueOnce(mockProduct()) // product exists
        .mockResolvedValueOnce(null); // sin target previo
      mockManager.create.mockReturnValue(target);
      mockManager.save.mockResolvedValue(target);

      const result = await service.create(1, { productId: 1 });
      expect(result.productId).toBe(1);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if coupon not found', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.create(999, { productId: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if coupon is global', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockCoupon({ isGlobal: true }));
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if coupon is expired', async () => {
      const past = new Date(Date.now() - 1000);
      mockManager.findOne.mockResolvedValueOnce(mockCoupon({ endsAt: past }));
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if coupon is exhausted', async () => {
      mockManager.findOne.mockResolvedValueOnce(
        mockCoupon({ usageLimit: 10, usageCount: 10 }),
      );
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon())
        .mockResolvedValueOnce(null);
      await expect(
        service.create(1, { productId: 999 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if target already exists', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon())
        .mockResolvedValueOnce(mockProduct())
        .mockResolvedValueOnce(mockTarget());
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on a unique constraint race at save time', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon())
        .mockResolvedValueOnce(mockProduct())
        .mockResolvedValueOnce(null); // pasó el chequeo previo
      mockManager.create.mockReturnValue(mockTarget());
      mockManager.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow unrelated database errors', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon())
        .mockResolvedValueOnce(mockProduct())
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue(mockTarget());
      mockManager.save.mockRejectedValue({ code: '08000' });

      await expect(
        service.create(1, { productId: 1 } as any),
      ).rejects.toMatchObject({ code: '08000' });
    });
  });

  describe('findAll', () => {
    it('should return all targets for a coupon', async () => {
      couponRepo.findOne.mockResolvedValue(mockCoupon());
      targetRepo.findAndCount.mockResolvedValue([[mockTarget()], 1]);
      const result = await service.findAll(1);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      couponRepo.findOne.mockResolvedValue(null);
      await expect(service.findAll(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a target', async () => {
      const target = mockTarget();
      couponRepo.findOne.mockResolvedValue(mockCoupon());
      targetRepo.findOne.mockResolvedValue(target);
      targetRepo.softDelete.mockResolvedValue(undefined);
      await service.remove(1, 1);
      expect(targetRepo.softDelete).toHaveBeenCalledWith(target.id);
    });

    it('should throw NotFoundException if target not found', async () => {
      couponRepo.findOne.mockResolvedValue(mockCoupon());
      targetRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
