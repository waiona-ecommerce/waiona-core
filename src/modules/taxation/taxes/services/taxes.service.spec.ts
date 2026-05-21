import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaxesService } from './taxes.service';
import { TaxEntity } from '../entities/tax.entity';
import { TaxTypeEntity } from '../../tax-types/entities/tax-types.entity';

describe('TaxesService', () => {
  let service: TaxesService;
  let taxRepo: any;
  let taxTypeRepo: any;

  const mockTaxRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockTaxTypeRepo = () => ({ findOne: jest.fn() });

  const mockTaxType = () => ({
    id: 1,
    code: 'IVA',
    name: 'IVA',
    deletedAt: null,
  });
  const mockTax = (overrides = {}): TaxEntity =>
    ({
      id: 1,
      taxTypeId: 1,
      value: 21,
      isPercentage: true,
      isGlobal: false,
      currency: null,
      deletedAt: null,
      taxType: mockTaxType(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as TaxEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxesService,
        { provide: getRepositoryToken(TaxEntity), useFactory: mockTaxRepo },
        {
          provide: getRepositoryToken(TaxTypeEntity),
          useFactory: mockTaxTypeRepo,
        },
      ],
    }).compile();

    service = module.get<TaxesService>(TaxesService);
    taxRepo = module.get(getRepositoryToken(TaxEntity));
    taxTypeRepo = module.get(getRepositoryToken(TaxTypeEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================
  describe('findAll', () => {
    it('should return taxes by taxTypeId', async () => {
      taxRepo.find.mockResolvedValue([mockTax()]);
      const result = await service.findAll(1);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(21);
    });

    it('should return empty array', async () => {
      taxRepo.find.mockResolvedValue([]);
      expect(await service.findAll(1)).toEqual([]);
    });
  });

  // ==========================
  // findById
  // ==========================
  describe('findById', () => {
    it('should return a tax by id', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax());
      const result = await service.findById(1);
      expect(result.id).toBe(1);
      expect(result.value).toBe(21);
    });

    it('should throw NotFoundException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================
  describe('create', () => {
    it('should create a percentage tax', async () => {
      const tax = mockTax();
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      taxRepo.create.mockReturnValue(tax);
      taxRepo.save.mockResolvedValue(tax);
      taxRepo.findOne.mockResolvedValue(tax); // recarga post-save

      const result = await service.create(1, {
        value: 21,
        isPercentage: true,
        isGlobal: false,
      });
      expect(result.value).toBe(21);
      expect(result.isPercentage).toBe(true);
    });

    it('should throw BadRequestException if taxType not found', async () => {
      taxTypeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(999, { value: 21, isPercentage: true } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if fixed tax has no currency', async () => {
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      await expect(
        service.create(1, { value: 500, isPercentage: false } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if percentage tax has currency', async () => {
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      await expect(
        service.create(1, {
          value: 21,
          isPercentage: true,
          currency: 'ARS',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // update
  // ==========================
  describe('update', () => {
    it('should update a tax', async () => {
      const tax = mockTax();
      const updated = mockTax({ value: 10.5 });
      taxRepo.findOne
        .mockResolvedValueOnce(tax) // findOne inicial
        .mockResolvedValueOnce(updated); // recarga post-save
      taxRepo.merge.mockReturnValue(updated);
      taxRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, { value: 10.5 });
      expect(result.value).toBe(10.5);
    });

    it('should throw NotFoundException if tax not found', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if removing currency from fixed tax', async () => {
      taxRepo.findOne.mockResolvedValue(
        mockTax({ isPercentage: false, currency: 'ARS' }),
      );
      await expect(
        service.update(1, { currency: null } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // delete
  // ==========================
  describe('delete', () => {
    it('should soft delete a tax', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(tax);
      taxRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete(1);

      expect(taxRepo.softDelete).toHaveBeenCalledWith(tax.id);
    });

    it('should throw NotFoundException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
