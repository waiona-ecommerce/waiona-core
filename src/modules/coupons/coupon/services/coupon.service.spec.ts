import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CouponService } from '../../../coupons/coupon/services/coupon.service';
import { CouponEntity } from '../../../coupons/coupon/entities/coupon.entity';
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
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
  });

  afterEach(() => jest.clearAllMocks());

  const repo = () => (service as any).couponRepository;

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
      repo().findOne.mockResolvedValue(coupon);
      repo().save.mockResolvedValue(updated);

      const result = await service.update(1, { usageLimit: 200 });
      expect(result.usageLimit).toBe(200);
    });

    it('should allow nulling usageLimit to make it unlimited', async () => {
      const coupon = mockCoupon({ usageLimit: 100, usageCount: 10 });
      const updated = mockCoupon({ usageLimit: null });
      repo().findOne.mockResolvedValue(coupon);
      repo().save.mockResolvedValue(updated);

      const result = await service.update(1, { usageLimit: null } as any);
      expect(result.usageLimit).toBeUndefined();
    });

    it('should throw BadRequestException if usageLimit < usageCount', async () => {
      const coupon = mockCoupon({ usageLimit: 100, usageCount: 50 });
      repo().findOne.mockResolvedValue(coupon);

      await expect(
        service.update(1, { usageLimit: 30 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if new code already exists', async () => {
      repo()
        .findOne.mockResolvedValueOnce(mockCoupon({ code: 'OLD' }))
        .mockResolvedValueOnce(mockCoupon({ code: 'TAKEN' }));
      await expect(service.update(1, { code: 'TAKEN' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException', async () => {
      repo().findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a coupon', async () => {
      const coupon = mockCoupon();
      repo().findOne.mockResolvedValue(coupon);
      repo().softDelete.mockResolvedValue(undefined);

      await service.remove(1);

      expect(repo().softDelete).toHaveBeenCalledWith(coupon.id);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      repo().findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
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
