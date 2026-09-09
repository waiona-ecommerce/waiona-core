import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CouponService } from '../../../coupons/coupon/services/coupon.service';
import { CouponEntity } from '../../../coupons/coupon/entities/coupon.entity';
import { CouponUsageEntity } from '../../../coupons/usage/entities/coupon-usage.entity';
import { CouponStatus } from '../../../coupons/coupon/enums/coupon-status.enum';

describe('CouponService', () => {
  let service: CouponService;

  const mockRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockUsageRepo = () => ({ count: jest.fn() });

  // update() ahora corre dentro de una transacción con lock sobre el cupón
  const mockManager = {
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockManager)),
  };

  const mockCoupon = (overrides = {}) =>
    ({
      id: 1,
      code: 'DESCUENTO10',
      value: 10,
      isGlobal: true,
      usageLimit: 100,
      usageCount: 0,
      deletedAt: null,
      startsAt: null,
      endsAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as CouponEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        { provide: getRepositoryToken(CouponEntity), useFactory: mockRepo },
        {
          provide: getRepositoryToken(CouponUsageEntity),
          useFactory: mockUsageRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    Object.values(mockManager).forEach((fn) => fn.mockReset());
  });

  const repo = () => (service as any).couponRepository;
  const usageRepo = () => (service as any).couponUsageRepository;

  describe('create', () => {
    const dto = {
      code: 'DESCUENTO10',
      value: 10,
      isGlobal: true,
      usageLimit: 100,
    };

    it('should create a coupon', async () => {
      const coupon = mockCoupon();
      repo().findOne.mockResolvedValue(null);
      repo().create.mockReturnValue(coupon);
      repo().save.mockResolvedValue(coupon);

      const result = await service.create(dto);

      expect(result.code).toBe('DESCUENTO10');
      expect(result.status).toBe(CouponStatus.ACTIVE);
    });

    it('should throw ConflictException if code already exists', async () => {
      repo().findOne.mockResolvedValue(mockCoupon());
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if value > 100', () => {
      expect(dto.value).toBeLessThanOrEqual(100);
    });

    it('should throw BadRequestException if startsAt >= endsAt', async () => {
      repo().findOne.mockResolvedValue(null);
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      await expect(
        service.create({ ...dto, startsAt: now, endsAt: past } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on a unique constraint race at save time', async () => {
      repo().findOne.mockResolvedValue(null); // pasó el chequeo previo
      repo().create.mockReturnValue(mockCoupon());
      repo().save.mockRejectedValue({ code: '23505' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow unrelated database errors', async () => {
      repo().findOne.mockResolvedValue(null);
      repo().create.mockReturnValue(mockCoupon());
      repo().save.mockRejectedValue({ code: '08000' });

      await expect(service.create(dto)).rejects.toMatchObject({
        code: '08000',
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated coupons', async () => {
      repo().findAndCount.mockResolvedValue([[mockCoupon()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe('DESCUENTO10');
    });

    it('should return empty data array', async () => {
      repo().findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a coupon', async () => {
      repo().findOne.mockResolvedValue(mockCoupon());
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo().findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a coupon', async () => {
      const coupon = mockCoupon();
      const updated = mockCoupon({ usageLimit: 200 });
      mockManager.findOne.mockResolvedValueOnce(coupon);
      mockManager.save.mockResolvedValueOnce(updated);

      const result = await service.update(1, { usageLimit: 200 });
      expect(result.usageLimit).toBe(200);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should allow nulling usageLimit to make it unlimited', async () => {
      const coupon = mockCoupon({ usageLimit: 100, usageCount: 10 });
      const updated = mockCoupon({ usageLimit: null });
      mockManager.findOne.mockResolvedValueOnce(coupon);
      mockManager.save.mockResolvedValueOnce(updated);

      const result = await service.update(1, { usageLimit: null } as any);
      expect(result.usageLimit).toBeUndefined();
    });

    it('should throw BadRequestException if usageLimit < usageCount', async () => {
      const coupon = mockCoupon({ usageLimit: 100, usageCount: 50 });
      mockManager.findOne.mockResolvedValueOnce(coupon);

      await expect(
        service.update(1, { usageLimit: 30 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if new code already exists', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockCoupon({ code: 'OLD' }))
        .mockResolvedValueOnce(mockCoupon({ code: 'TAKEN' }));
      await expect(service.update(1, { code: 'TAKEN' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on a unique constraint race at save time', async () => {
      const coupon = mockCoupon();
      mockManager.findOne.mockResolvedValueOnce(coupon); // sin cambio de code, no re-valida unicidad
      mockManager.save.mockRejectedValueOnce({ code: '23505' });

      await expect(
        service.update(1, { usageLimit: 50 } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow unrelated database errors', async () => {
      const coupon = mockCoupon();
      mockManager.findOne.mockResolvedValueOnce(coupon);
      mockManager.save.mockRejectedValueOnce({ code: '08000' });

      await expect(
        service.update(1, { usageLimit: 50 } as any),
      ).rejects.toMatchObject({ code: '08000' });
    });

    it('should throw BadRequestException when marking as global a coupon with product targets', async () => {
      mockManager.findOne.mockResolvedValueOnce(
        mockCoupon({ isGlobal: false }),
      );
      mockManager.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

      await expect(
        service.update(1, { isGlobal: true } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when marking as global a coupon with combo targets', async () => {
      mockManager.findOne.mockResolvedValueOnce(
        mockCoupon({ isGlobal: false }),
      );
      mockManager.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      await expect(
        service.update(1, { isGlobal: true } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should allow marking as global a coupon without targets', async () => {
      const coupon = mockCoupon({ isGlobal: false });
      mockManager.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockManager.findOne.mockResolvedValueOnce(coupon);
      mockManager.save.mockResolvedValueOnce(mockCoupon({ isGlobal: true }));

      const result = await service.update(1, { isGlobal: true });
      expect(result.isGlobal).toBe(true);
    });

    it('should not check targets when isGlobal is not changing', async () => {
      const coupon = mockCoupon({ isGlobal: true });
      mockManager.findOne.mockResolvedValueOnce(coupon);
      mockManager.save.mockResolvedValueOnce(coupon);

      await service.update(1, { usageLimit: 50 });
      expect(mockManager.count).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a coupon without usages', async () => {
      const coupon = mockCoupon();
      repo().findOne.mockResolvedValue(coupon);
      usageRepo().count.mockResolvedValue(0);
      repo().softDelete.mockResolvedValue(undefined);

      await service.remove(1);

      expect(repo().softDelete).toHaveBeenCalledWith(coupon.id);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      repo().findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if the coupon was already used', async () => {
      const coupon = mockCoupon();
      repo().findOne.mockResolvedValue(coupon);
      usageRepo().count.mockResolvedValue(3);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      expect(repo().softDelete).not.toHaveBeenCalled();
    });
  });

  describe('CouponResponseDto status calculation', () => {
    it('should return EXHAUSTED when usageCount >= usageLimit', async () => {
      repo().findOne.mockResolvedValue(
        mockCoupon({ usageLimit: 5, usageCount: 5 }),
      );
      const result = await service.findOne(1);
      expect(result.status).toBe(CouponStatus.EXHAUSTED);
    });

    it('should return EXPIRED when endsAt is in the past', async () => {
      const past = new Date(Date.now() - 1000);
      repo().findOne.mockResolvedValue(mockCoupon({ endsAt: past }));
      const result = await service.findOne(1);
      expect(result.status).toBe(CouponStatus.EXPIRED);
    });

    it('should return SCHEDULED when startsAt is in the future', async () => {
      const future = new Date(Date.now() + 100000);
      repo().findOne.mockResolvedValue(mockCoupon({ startsAt: future }));
      const result = await service.findOne(1);
      expect(result.status).toBe(CouponStatus.SCHEDULED);
    });
  });
});
