import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ComboPricingService } from './../services/combo-pricing.service';
import { ComboPricingEntity } from './../entities/combo-pricing.entity';
import { MarginEntity } from 'src/modules/margins/entities/margin.entity';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

describe('ComboPricingService', () => {
  let service: ComboPricingService;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockMarginRepo = () => ({ findOne: jest.fn() });

  const mockMargin = { id: 1, value: 20, isPercentage: true };
  const mockPricing = (overrides = {}): ComboPricingEntity =>
    ({
      id: 1,
      comboId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 1200,
      margin: mockMargin,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ComboPricingEntity;

  let repo: any;
  let marginRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComboPricingService,
        {
          provide: getRepositoryToken(ComboPricingEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(MarginEntity),
          useFactory: mockMarginRepo,
        },
      ],
    }).compile();

    service = module.get<ComboPricingService>(ComboPricingService);
    repo = module.get(getRepositoryToken(ComboPricingEntity));
    marginRepo = module.get(getRepositoryToken(MarginEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const dto = {
      comboId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 1200,
      marginId: 1,
    };

    it('should create pricing with margin', async () => {
      const pricing = mockPricing();
      repo.findOne.mockResolvedValueOnce(null);
      marginRepo.findOne.mockResolvedValue(mockMargin);
      repo.create.mockReturnValue(pricing);
      repo.save.mockResolvedValue(pricing);

      const result = await service.create(dto);
      expect(result.unitPrice).toBe(1200);
      expect(result.marginId).toBe(1);
    });

    it('should throw BadRequestException if combo already has pricing', async () => {
      repo.findOne.mockResolvedValue(mockPricing());
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if margin not found', async () => {
      repo.findOne.mockResolvedValue(null);
      marginRepo.findOne.mockResolvedValue(null);
      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on unique constraint race condition', async () => {
      repo.findOne.mockResolvedValue(null);
      marginRepo.findOne.mockResolvedValue(mockMargin);
      repo.create.mockReturnValue(mockPricing());
      repo.save.mockRejectedValue({ code: '23505' });
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all pricings', async () => {
      repo.findAndCount.mockResolvedValue([[mockPricing()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].comboId).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return pricing by id', async () => {
      repo.findOne.mockResolvedValue(mockPricing());
      expect((await service.findOne(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCombo', () => {
    it('should return pricing by comboId', async () => {
      repo.findOne.mockResolvedValue(mockPricing());
      expect((await service.findByCombo(1)).comboId).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findByCombo(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update pricing', async () => {
      const updated = mockPricing({ unitPrice: 1500 });
      repo.findOne.mockResolvedValueOnce(mockPricing());
      marginRepo.findOne.mockResolvedValue(mockMargin);
      repo.save.mockResolvedValue(updated);

      const result = await service.update(1, { unitPrice: 1500 });
      expect(result.unitPrice).toBe(1500);
    });

    it('should clear margin when marginId is null', async () => {
      const updated = mockPricing({ margin: null });
      repo.findOne.mockResolvedValueOnce(mockPricing());
      repo.save.mockResolvedValue(updated);

      const result = await service.update(1, { marginId: null });
      expect(result.marginId).toBeNull();
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete pricing', async () => {
      const pricing = mockPricing();
      repo.findOne.mockResolvedValue(pricing);
      repo.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove(1);
      expect(repo.softDelete).toHaveBeenCalledWith(pricing.id);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
