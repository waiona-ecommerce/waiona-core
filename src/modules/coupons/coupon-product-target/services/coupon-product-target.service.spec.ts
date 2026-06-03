import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CouponProductTargetService } from '../../../coupons/coupon-product-target/services/coupon-product-target.service';
import { CouponProductTargetEntity } from '../../../coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponEntity } from '../../../coupons/coupon/entities/coupon.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';

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
  const mockProductRepo = () => ({ findOne: jest.fn() });

  const mockCoupon = (overrides = {}) => ({
    id: 1,
    code: 'FIJO500',
    isGlobal: false,
    isDeleted: false,
    ...overrides,
  });
  const mockTarget = (overrides = {}) => ({
    id: 1,
    couponId: 1,
    productId: 1,
    isDeleted: false,
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
  let productRepo: any;

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
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockProductRepo,
        },
      ],
    }).compile();

    service = module.get<CouponProductTargetService>(
      CouponProductTargetService,
    );
    targetRepo = module.get(getRepositoryToken(CouponProductTargetEntity));
    couponRepo = module.get(getRepositoryToken(CouponEntity));
    productRepo = module.get(getRepositoryToken(ProductEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a product target', async () => {
      const target = mockTarget();
      couponRepo.findOne.mockResolvedValue(mockCoupon());
      productRepo.findOne.mockResolvedValue(mockProduct());
      targetRepo.findOne.mockResolvedValue(null);
      targetRepo.create.mockReturnValue(target);
      targetRepo.save.mockResolvedValue(target);

      const result = await service.create(1, { productId: 1 });
      expect(result.productId).toBe(1);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      couponRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(999, { productId: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if coupon is global', async () => {
      couponRepo.findOne.mockResolvedValue(mockCoupon({ isGlobal: true }));
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      couponRepo.findOne.mockResolvedValue(mockCoupon());
      productRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(1, { productId: 999 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if target already exists', async () => {
      couponRepo.findOne.mockResolvedValue(mockCoupon());
      productRepo.findOne.mockResolvedValue(mockProduct());
      targetRepo.findOne.mockResolvedValue(mockTarget());
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
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
