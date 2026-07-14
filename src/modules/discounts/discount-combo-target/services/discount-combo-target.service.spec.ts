import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DiscountComboTargetService } from './discount-combo-target.service';
import { DiscountComboTargetEntity } from '../entities/discount-combo-target.entity';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
describe('DiscountComboTargetService', () => {
  let service: DiscountComboTargetService;
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

  const mockDiscount = () => ({ id: 1, name: 'PROMO', deletedAt: null });
  const mockTarget = (overrides = {}): DiscountComboTargetEntity =>
    ({
      id: 1,
      discountId: 1,
      comboId: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as DiscountComboTargetEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountComboTargetService,
        {
          provide: getRepositoryToken(DiscountComboTargetEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(DiscountEntity),
          useFactory: mockDiscountRepo,
        },
      ],
    }).compile();
    service = module.get<DiscountComboTargetService>(
      DiscountComboTargetService,
    );
    repo = module.get(getRepositoryToken(DiscountComboTargetEntity));
    discountRepo = module.get(getRepositoryToken(DiscountEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a combo target', async () => {
      const target = mockTarget();
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValueOnce(null); // validateUniqueTarget
      repo.findOne.mockResolvedValueOnce(null); // validateComboHasNoActiveDiscount
      repo.create.mockReturnValue(target);
      repo.save.mockResolvedValue(target);
      const result = await service.create(1, { comboId: 1 });
      expect(result.comboId).toBe(1);
    });

    it('should throw NotFoundException if discount not found', async () => {
      discountRepo.findOne.mockResolvedValue(null);
      await expect(service.create(999, { comboId: 1 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if target already exists for this discount', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValueOnce(mockTarget());
      await expect(service.create(1, { comboId: 1 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if combo already has another active discount', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValueOnce(null); // validateUniqueTarget
      repo.findOne.mockResolvedValueOnce(mockTarget()); // validateComboHasNoActiveDiscount
      await expect(service.create(1, { comboId: 1 } as any)).rejects.toThrow(
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

    it('should throw NotFoundException if target not found', async () => {
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
