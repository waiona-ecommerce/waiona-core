import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ProductPricingService } from './../services/product-pricing.service';
import { ProductPricingEntity } from './../entities/product-pricing.entity';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';

describe('ProductPricingService', () => {
  let service: ProductPricingService;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockPricing = (overrides = {}): ProductPricingEntity =>
    ({
      id: 1,
      productId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 500,
      salePrice: 750,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ProductPricingEntity;

  let repo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductPricingService,
        {
          provide: getRepositoryToken(ProductPricingEntity),
          useFactory: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ProductPricingService>(ProductPricingService);
    repo = module.get(getRepositoryToken(ProductPricingEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const dto = {
      productId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 500,
      salePrice: 750,
    };

    it('should create pricing', async () => {
      const pricing = mockPricing();
      repo.findOne.mockResolvedValueOnce(null);
      repo.create.mockReturnValue(pricing);
      repo.save.mockResolvedValue(pricing);

      const result = await service.create(dto);
      expect(result.unitPrice).toBe(500);
      expect(result.salePrice).toBe(750);
    });

    it('should throw BadRequestException if salePrice <= unitPrice', async () => {
      await expect(
        service.create({ ...dto, salePrice: 500 } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ ...dto, salePrice: 499 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if product already has pricing', async () => {
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

    it('should throw NotFoundException on FK violation (productId not found)', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPricing());
      repo.save.mockRejectedValue({ code: '23503' });
      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all pricings and query with skip/take', async () => {
      repo.findAndCount.mockResolvedValue([[mockPricing()], 25]);

      const result = await service.findAll(2, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith({ skip: 10, take: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].productId).toBe(1);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('should return empty array', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
      expect(result.totalPages).toBe(0);
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
    it('should merge the dto into the entity and save it', async () => {
      repo.findOne.mockResolvedValueOnce(mockPricing()); // unitPrice=500, salePrice=750
      repo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.update(1, {
        unitPrice: 600,
        salePrice: 900,
      });

      expect(result.unitPrice).toBe(600);
      expect(result.salePrice).toBe(900);
    });

    it('keeps existing fields when only one is provided', async () => {
      repo.findOne.mockResolvedValueOnce(mockPricing()); // unitPrice=500, salePrice=750
      repo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.update(1, { unitPrice: 600 });

      expect(result.unitPrice).toBe(600);
      expect(result.salePrice).toBe(750);
    });

    it('should throw BadRequestException on numeric overflow', async () => {
      repo.findOne.mockResolvedValueOnce(mockPricing()); // unitPrice=500, salePrice=750
      repo.save.mockRejectedValue({ code: '22003' });
      await expect(
        service.update(1, { salePrice: 999999999999 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if effective salePrice <= unitPrice', async () => {
      repo.findOne.mockResolvedValueOnce(mockPricing()); // unitPrice=500, salePrice=750
      await expect(
        service.update(1, { salePrice: 400 } as any),
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
