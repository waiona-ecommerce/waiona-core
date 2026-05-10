import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DiscountsService } from '../../discount/services/discounts.service';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

describe('DiscountsService', () => {
  let service: DiscountsService;
  let repo: any;

  const mockRepo = () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() });

  const mockDiscount = (overrides = {}): DiscountEntity =>
    ({ id: 1, name: 'Promo 10%', description: 'Descuento de prueba', value: 10, isPercentage: true,
       currency: null, startsAt: null, endsAt: null, isDeleted: false,
       createdAt: new Date(), updatedAt: new Date(), ...overrides }) as unknown as DiscountEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountsService,
        { provide: getRepositoryToken(DiscountEntity), useFactory: mockRepo },
      ],
    }).compile();
    service = module.get<DiscountsService>(DiscountsService);
    repo    = module.get(getRepositoryToken(DiscountEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a percentage discount', async () => {
      const entity = mockDiscount();
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);
      const result = await service.create({ name: 'Promo', value: 10, isPercentage: true } as any);
      expect(result.value).toBe(10);
    });

    it('should throw BadRequestException if percentage > 100', async () => {
      await expect(service.create({ name: 'X', value: 110, isPercentage: true } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if fixed discount has no currency', async () => {
      await expect(service.create({ name: 'X', value: 500, isPercentage: false } as any)).rejects.toThrow(BadRequestException);
    });

    it('should create fixed discount with currency', async () => {
      const entity = mockDiscount({ isPercentage: false, currency: CurrencyCode.ARS, value: 500 });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);
      const result = await service.create({ name: 'X', value: 500, isPercentage: false, currency: CurrencyCode.ARS } as any);
      expect(result.isPercentage).toBe(false);
    });

    it('should throw BadRequestException if startsAt >= endsAt', async () => {
      const now  = new Date();
      const past = new Date(now.getTime() - 1000);
      await expect(service.create({ name: 'X', value: 10, isPercentage: true, startsAt: now, endsAt: past } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all discounts', async () => {
      repo.find.mockResolvedValue([mockDiscount()]);
      expect(await service.findAll()).toHaveLength(1);
    });

    it('should return empty array', async () => {
      repo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
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
  });

  describe('update', () => {
    it('should update a discount', async () => {
      const entity  = mockDiscount();
      const updated = mockDiscount({ name: 'Promo Actualizada' });
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue(updated);
      expect((await service.update(1, { name: 'Promo Actualizada' } as any)).name).toBe('Promo Actualizada');
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete', async () => {
      const entity = mockDiscount();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue({ ...entity, isDeleted: true });
      await service.remove(1);
      expect(repo.save).toHaveBeenCalledWith({ ...entity, isDeleted: true });
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});