import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DiscountProductTargetService } from '../../discount-product-target/services/discount-product-target.service';
import { DiscountProductTargetEntity } from '../../discount-product-target/entities/discount-product-target.entity';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
describe('DiscountProductTargetService', () => {
  let service: DiscountProductTargetService;
  let repo: any;
  let discountRepo: any;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockDiscountRepo = () => ({ findOne: jest.fn() });

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
      repo.findOne.mockResolvedValueOnce(null); // validateProductHasNoActiveDiscount
      repo.create.mockReturnValue(target);
      repo.save.mockResolvedValue(target);
      expect((await service.create(1, { productId: 1 } as any)).productId).toBe(
        1,
      );
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
      repo.findOne.mockResolvedValueOnce(mockTarget()); // validateProductHasNoActiveDiscount
      await expect(service.create(1, { productId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all targets', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findAndCount.mockResolvedValue([[mockTarget()], 1]);
      const result = await service.findAll(1);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should query with createdAt DESC order', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('should throw NotFoundException if discount not found', async () => {
      discountRepo.findOne.mockResolvedValue(null);
      await expect(service.findAll(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete target', async () => {
      const target = mockTarget();
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValue(target);
      repo.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove(1, 1);
      expect(repo.softDelete).toHaveBeenCalledWith(target.id);
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
