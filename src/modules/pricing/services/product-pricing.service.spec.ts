import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductPricingService } from './../services/product-pricing.service';
import { ProductPricingEntity } from './../entities/product-pricing.entity';
import { MarginEntity } from '../../margins/entities/margin.entity';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';
import { ShopCacheService } from '../../../common/cache/shop-cache.service';

describe('ProductPricingService', () => {
  let service: ProductPricingService;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockMarginRepo = () => ({ findOne: jest.fn() });

  const mockMargin = { id: 1, value: 20, isPercentage: true };
  const mockPricing = (overrides = {}): ProductPricingEntity =>
    ({
      id: 1,
      productId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 500,
      margin: mockMargin,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ProductPricingEntity;

  let repo: any;
  let marginRepo: any;

  const mockShopCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductPricingService,
        {
          provide: getRepositoryToken(ProductPricingEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(MarginEntity),
          useFactory: mockMarginRepo,
        },
        { provide: ShopCacheService, useValue: mockShopCacheService },
      ],
    }).compile();

    service = module.get<ProductPricingService>(ProductPricingService);
    repo = module.get(getRepositoryToken(ProductPricingEntity));
    marginRepo = module.get(getRepositoryToken(MarginEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const dto = {
      productId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 500,
      marginId: 1,
    };

    it('should create pricing with margin', async () => {
      const pricing = mockPricing();
      repo.findOne.mockResolvedValueOnce(null); // no existe
      marginRepo.findOne.mockResolvedValue(mockMargin);
      repo.create.mockReturnValue(pricing);
      repo.save.mockResolvedValue(pricing);

      const result = await service.create(dto);
      expect(result.unitPrice).toBe(500);
      expect(result.marginId).toBe(1);
    });

    it('should create pricing without margin', async () => {
      const pricing = mockPricing({ margin: null });
      repo.findOne.mockResolvedValueOnce(null);
      repo.create.mockReturnValue(pricing);
      repo.save.mockResolvedValue(pricing);

      const result = await service.create({
        ...dto,
        marginId: undefined,
      });
      expect(result.marginId).toBeNull();
    });

    it('should throw ConflictException if product already has pricing', async () => {
      repo.findOne.mockResolvedValue(mockPricing());
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if margin not found', async () => {
      repo.findOne.mockResolvedValue(null);
      marginRepo.findOne.mockResolvedValue(null);
      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on unique constraint race condition', async () => {
      repo.findOne.mockResolvedValue(null);
      marginRepo.findOne.mockResolvedValue(mockMargin);
      repo.create.mockReturnValue(mockPricing());
      repo.save.mockRejectedValue({ code: '23505' });
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all pricings', async () => {
      repo.findAndCount.mockResolvedValue([[mockPricing()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].productId).toBe(1);
    });

    it('should return empty array', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return pricing by id', async () => {
      repo.findOne.mockResolvedValue(mockPricing());
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProduct', () => {
    it('should return pricing by productId', async () => {
      repo.findOne.mockResolvedValue(mockPricing());
      const result = await service.findByProduct(1);
      expect(result.productId).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findByProduct(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update pricing', async () => {
      const updated = mockPricing({ unitPrice: 600 });
      repo.findOne.mockResolvedValueOnce(mockPricing()); // findOneEntity
      marginRepo.findOne.mockResolvedValue(mockMargin);
      repo.save.mockResolvedValue(updated);

      const result = await service.update(1, { unitPrice: 600 });
      expect(result.unitPrice).toBe(600);
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
