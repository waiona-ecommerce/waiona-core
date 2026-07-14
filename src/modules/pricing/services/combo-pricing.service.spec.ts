import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ComboPricingService } from './../services/combo-pricing.service';
import { ComboPricingEntity } from './../entities/combo-pricing.entity';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';

describe('ComboPricingService', () => {
  let service: ComboPricingService;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockPricing = (overrides = {}): ComboPricingEntity =>
    ({
      id: 1,
      comboId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 1200,
      salePrice: 1500,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ComboPricingEntity;

  let repo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComboPricingService,
        {
          provide: getRepositoryToken(ComboPricingEntity),
          useFactory: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ComboPricingService>(ComboPricingService);
    repo = module.get(getRepositoryToken(ComboPricingEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const dto = {
      comboId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 1200,
      salePrice: 1500,
    };

    it('should create pricing', async () => {
      const pricing = mockPricing();
      repo.findOne.mockResolvedValueOnce(null);
      repo.create.mockReturnValue(pricing);
      repo.save.mockResolvedValue(pricing);

      const result = await service.create(dto);
      expect(result.unitPrice).toBe(1200);
      expect(result.salePrice).toBe(1500);
    });

    it('should throw BadRequestException if salePrice <= unitPrice', async () => {
      await expect(
        service.create({ ...dto, salePrice: 1200 } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ ...dto, salePrice: 1000 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if combo already has pricing', async () => {
      repo.findOne.mockResolvedValue(mockPricing());
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on unique constraint race condition', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPricing());
      repo.save.mockRejectedValue({ code: '23505' });
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException on FK violation (comboId not found)', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPricing());
      repo.save.mockRejectedValue({ code: '23503' });
      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
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
      const updated = mockPricing({ unitPrice: 1300 });
      repo.findOne.mockResolvedValueOnce(mockPricing()); // unitPrice=1200, salePrice=1500
      repo.save.mockResolvedValue(updated);

      const result = await service.update(1, { unitPrice: 1300 });
      expect(result.unitPrice).toBe(1300);
    });

    it('should throw BadRequestException if effective salePrice <= unitPrice', async () => {
      repo.findOne.mockResolvedValueOnce(mockPricing()); // unitPrice=1200, salePrice=1500
      await expect(
        service.update(1, { salePrice: 1000 } as any),
      ).rejects.toThrow(BadRequestException);
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
