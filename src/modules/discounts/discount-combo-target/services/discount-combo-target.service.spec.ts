import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DiscountComboTargetService } from '../../discount-combo-target/services/discount-combo-target.service';
import { DiscountComboTargetEntity } from '../../discount-combo-target/entities/discount-combo-target.entity';
import { DiscountEntity } from '../../discount/entities/discounts.entity';

describe('DiscountComboTargetService', () => {
  let service: DiscountComboTargetService;
  let repo: any;
  let discountRepo: any;

  const mockRepo         = () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() });
  const mockDiscountRepo = () => ({ findOne: jest.fn() });

  const mockDiscount = () => ({ id: 1, name: 'Promo', isDeleted: false });
  const mockTarget   = (overrides = {}) => ({ id: 1, discountId: 1, comboId: 1, isDeleted: false, createdAt: new Date(), updatedAt: new Date(), ...overrides });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DiscountComboTargetService,
        { provide: getRepositoryToken(DiscountComboTargetEntity), useFactory: mockRepo         },
        { provide: getRepositoryToken(DiscountEntity),            useFactory: mockDiscountRepo },
      ],
    }).compile();
    service      = module.get<DiscountComboTargetService>(DiscountComboTargetService);
    repo         = module.get(getRepositoryToken(DiscountComboTargetEntity));
    discountRepo = module.get(getRepositoryToken(DiscountEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a combo target', async () => {
      const target = mockTarget();
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      repo.create.mockReturnValue(target);
      repo.save.mockResolvedValue(target);
      expect((await service.create(1, { comboId: 1 } as any)).comboId).toBe(1);
    });

    it('should throw NotFoundException if discount not found', async () => {
      discountRepo.findOne.mockResolvedValue(null);
      await expect(service.create(999, { comboId: 1 } as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if target already exists', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValue(mockTarget());
      await expect(service.create(1, { comboId: 1 } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all targets', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.find.mockResolvedValue([mockTarget()]);
      expect(await service.findAll(1)).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should soft delete', async () => {
      const target = mockTarget();
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValue(target);
      repo.save.mockResolvedValue({ ...target, isDeleted: true });
      await service.remove(1, 1);
      expect(repo.save).toHaveBeenCalledWith({ ...target, isDeleted: true });
    });

    it('should throw NotFoundException', async () => {
      discountRepo.findOne.mockResolvedValue(mockDiscount());
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 999)).rejects.toThrow(NotFoundException);
    });
  });
});