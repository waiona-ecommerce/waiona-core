import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaxesService } from '../../../taxation/taxes/services/taxes.service';
import { TaxEntity } from '../../../taxation/taxes/entities/tax.entity';
import { TaxTypeEntity } from '../../../taxation/tax-types/entities/tax-types.entity';

describe('TaxesService', () => {
  let service: TaxesService;
  let taxRepo: any;
  let taxTypeRepo: any;

  const mockTaxRepo     = () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() });
  const mockTaxTypeRepo = () => ({ findOne: jest.fn() });

  const mockTaxType = () => ({ id: 1, name: 'IVA', isDeleted: false });
  const mockTax     = (overrides = {}): TaxEntity =>
    ({ id: 1, name: 'IVA 21%', value: 21, isPercentage: true, taxTypeId: 1,
       isDeleted: false, createdAt: new Date(), updatedAt: new Date(), ...overrides }) as unknown as TaxEntity;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TaxesService,
        { provide: getRepositoryToken(TaxEntity),     useFactory: mockTaxRepo     },
        { provide: getRepositoryToken(TaxTypeEntity), useFactory: mockTaxTypeRepo },
      ],
    }).compile();
    service     = module.get<TaxesService>(TaxesService);
    taxRepo     = module.get(getRepositoryToken(TaxEntity));
    taxTypeRepo = module.get(getRepositoryToken(TaxTypeEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return taxes by taxTypeId', async () => {
      taxRepo.find.mockResolvedValue([mockTax()]);
      expect(await service.findAll(1)).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a tax', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax());
      expect((await service.findById(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a tax', async () => {
      const tax = mockTax();
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      taxRepo.findOne.mockResolvedValue(null);
      taxRepo.create.mockReturnValue(tax);
      taxRepo.save.mockResolvedValue(tax);
      expect((await service.create(1, { name: 'IVA 21%', value: 21, isPercentage: true } as any)).name).toBe('IVA 21%');
    });

    it('should throw NotFoundException if taxType not found', async () => {
      taxTypeRepo.findOne.mockResolvedValue(null);
      await expect(service.create(999, { name: 'X', value: 21, isPercentage: true } as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if percentage > 100', async () => {
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      await expect(service.create(1, { name: 'X', value: 110, isPercentage: true } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a tax', async () => {
      const tax     = mockTax();
      const updated = mockTax({ name: 'IVA 10.5%', value: 10.5 });
      taxRepo.findOne.mockResolvedValue(tax);
      taxRepo.save.mockResolvedValue(updated);
      expect((await service.update(1, { value: 10.5 } as any)).value).toBe(10.5);
    });

    it('should throw NotFoundException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(tax);
      taxRepo.save.mockResolvedValue({ ...tax, isDeleted: true });
      await service.remove(1);
      expect(taxRepo.save).toHaveBeenCalledWith({ ...tax, isDeleted: true });
    });

    it('should throw NotFoundException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});