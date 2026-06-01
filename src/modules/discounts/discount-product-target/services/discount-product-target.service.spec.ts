import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DiscountProductTargetService } from '../../discount-product-target/services/discount-product-target.service';
import { DiscountProductTargetEntity } from '../../discount-product-target/entities/discount-product-target.entity';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
import { ShopCacheService } from '../../../../common/cache/shop-cache.service';

describe('DiscountProductTargetService', () => {
  let service: DiscountProductTargetService;
  let repo: any;
  let discountRepo: any;
  let qb: any;

  const mockRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });
  const mockDiscountRepo = () => ({ findOne: jest.fn() });
  const mockShopCacheService = { invalidate: jest.fn() };

  const mockDiscount = () => ({ id: 1, name: 'Promo', deletedAt: null });
  const mockTarget = (overrides = {}) => ({
    id: 1,
    discountId: 1,
    productId: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DiscountProductTargetService,
        {
          provide: getRepositoryToken(DiscountProductTargetEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(DiscountEntity),
          useFactory: mockDiscountRepo,
        },
        { provide: ShopCacheService, useValue: mockShopCacheService },
      ],
    }).compile();
    service = module.get<DiscountProductTargetService>(
      DiscountProductTargetService,
    );
    repo = module.get(getRepositoryToken(DiscountProductTargetEntity));
    discountRepo = module.get(getRepositoryToken(DiscountEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a product target', async () => {
      const target = mockTarget();
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValueOnce(null); // validateUniqueTarget
      repo.createQueryBuilder.mockReturnValue(qb);
      qb.getOne.mockResolvedValue(null); // validateProductHasNoActiveDiscount
      repo.create.mockReturnValue(target);
      repo.save.mockResolvedValue(target);
      expect((await service.create(1, { productId: 1 } as any)).productId).toBe(
        1,
      );
      expect(mockShopCacheService.invalidate).toHaveBeenCalled();
    });

    it('should throw NotFoundException if discount not found', async () => {
      discountRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(999, { productId: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if target already exists for this discount', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValueOnce(mockTarget());
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if product already has another active discount', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValueOnce(null); // validateUniqueTarget
      repo.createQueryBuilder.mockReturnValue(qb);
      qb.getOne.mockResolvedValue(mockTarget()); // validateProductHasNoActiveDiscount
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all targets', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.find.mockResolvedValue([mockTarget()]);
      expect(await service.findAll(1)).toHaveLength(1);
    });

    it('should throw NotFoundException if discount not found', async () => {
      discountRepo.findOne.mockResolvedValue(null);
      await expect(service.findAll(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete target', async () => {
      const target = mockTarget();
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValue(target);
      repo.softDelete.mockResolvedValue(undefined);
      await service.remove(1, 1);
      expect(repo.softDelete).toHaveBeenCalledWith(target.id);
      expect(mockShopCacheService.invalidate).toHaveBeenCalled();
    });

    it('should throw NotFoundException if not found', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if discount not found', async () => {
      discountRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
