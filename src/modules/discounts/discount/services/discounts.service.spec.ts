import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DiscountsService } from '../../discount/services/discounts.service';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
import { DiscountProductTargetEntity } from '../../discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from '../../discount-combo-target/entities/discount-combo-target.entity';
describe('DiscountsService', () => {
  let service: DiscountsService;
  let repo: any;
  let productTargetRepo: any;
  let comboTargetRepo: any;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockTargetRepo = () => ({ softDelete: jest.fn() });

  const mockDiscount = (overrides = {}): DiscountEntity => ({
    id: 1,
    name: 'Promo 10%',
    description: 'Descuento de prueba',
    value: 10,
    startsAt: null,
    endsAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountsService,
        { provide: getRepositoryToken(DiscountEntity), useFactory: mockRepo },
        {
          provide: getRepositoryToken(DiscountProductTargetEntity),
          useFactory: mockTargetRepo,
        },
        {
          provide: getRepositoryToken(DiscountComboTargetEntity),
          useFactory: mockTargetRepo,
        },
      ],
    }).compile();
    service = module.get<DiscountsService>(DiscountsService);
    repo = module.get(getRepositoryToken(DiscountEntity));
    productTargetRepo = module.get(
      getRepositoryToken(DiscountProductTargetEntity),
    );
    comboTargetRepo = module.get(getRepositoryToken(DiscountComboTargetEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a discount', async () => {
      const entity = mockDiscount();
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);
      const result = await service.create({ name: 'Promo', value: 10 });
      expect(result.value).toBe(10);
    });

    it('should throw BadRequestException if startsAt >= endsAt', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      await expect(
        service.create({
          name: 'X',
          value: 10,
          startsAt: now,
          endsAt: past,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if only startsAt is provided', async () => {
      await expect(
        service.create({ name: 'X', value: 10, startsAt: new Date() } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if only endsAt is provided', async () => {
      await expect(
        service.create({ name: 'X', value: 10, endsAt: new Date() } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated discounts', async () => {
      repo.findAndCount.mockResolvedValue([[mockDiscount()], 1]);
      const result = await service.findAll(1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty data when no discounts', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll(1, 20);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a discount', async () => {
      repo.findOne.mockResolvedValue(mockDiscount());
      expect((await service.findOne(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should return status ACTIVE when no dates', async () => {
      repo.findOne.mockResolvedValue(
        mockDiscount({ startsAt: null, endsAt: null }),
      );
      expect((await service.findOne(1)).status).toBe('active');
    });

    it('should return status SCHEDULED when startsAt is in the future', async () => {
      const future = new Date(Date.now() + 86400000);
      repo.findOne.mockResolvedValue(
        mockDiscount({
          startsAt: future,
          endsAt: new Date(Date.now() + 172800000),
        }),
      );
      expect((await service.findOne(1)).status).toBe('scheduled');
    });

    it('should return status EXPIRED when endsAt is in the past', async () => {
      const past = new Date(Date.now() - 86400000);
      repo.findOne.mockResolvedValue(
        mockDiscount({
          startsAt: new Date(Date.now() - 172800000),
          endsAt: past,
        }),
      );
      expect((await service.findOne(1)).status).toBe('expired');
    });
  });

  describe('update', () => {
    it('should update a discount', async () => {
      const entity = mockDiscount();
      const updated = mockDiscount({ name: 'Promo Actualizada' });
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue(updated);
      expect(
        (await service.update(1, { name: 'Promo Actualizada' } as any)).name,
      ).toBe('Promo Actualizada');
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if updating only startsAt on a discount with no endsAt', async () => {
      repo.findOne.mockResolvedValue(
        mockDiscount({ startsAt: null, endsAt: null }),
      );
      await expect(
        service.update(1, { startsAt: new Date() } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete discount and cascade to targets', async () => {
      const entity = mockDiscount();
      repo.findOne.mockResolvedValue(entity);
      repo.softDelete.mockResolvedValue(undefined);
      productTargetRepo.softDelete.mockResolvedValue(undefined);
      comboTargetRepo.softDelete.mockResolvedValue(undefined);
      await service.remove(1);
      expect(repo.softDelete).toHaveBeenCalledWith(entity.id);
      expect(productTargetRepo.softDelete).toHaveBeenCalledWith({
        discountId: entity.id,
      });
      expect(comboTargetRepo.softDelete).toHaveBeenCalledWith({
        discountId: entity.id,
      });
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
