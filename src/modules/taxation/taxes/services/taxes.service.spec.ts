import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TaxesService } from './taxes.service';
import { TaxEntity } from '../entities/tax.entity';
import { ProductTaxEntity } from '../../product-taxes/entities/product-taxes.entity';

describe('TaxesService', () => {
  let service: TaxesService;
  let taxRepo: any;
  let productTaxRepo: any;

  const mockTaxRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockProductTaxRepo = () => ({ findOne: jest.fn() });

  const mockTax = (overrides = {}): TaxEntity =>
    ({
      id: 1,
      code: 'IVA',
      name: 'IMPUESTO AL VALOR AGREGADO',
      value: 21,
      deletedAt: null,
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
          provide: getRepositoryToken(ProductTaxEntity),
          useFactory: mockProductTaxRepo,
        },
      ],
    }).compile();

    service = module.get<TaxesService>(TaxesService);
    taxRepo = module.get(getRepositoryToken(TaxEntity));
    productTaxRepo = module.get(getRepositoryToken(ProductTaxEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return paginated taxes', async () => {
      taxRepo.findAndCount.mockResolvedValue([[mockTax()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe('IVA');
      expect(result.total).toBe(1);
    });

    it('should return empty page', async () => {
      taxRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
    });
  });

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

  describe('create', () => {
    it('should create a tax', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(null);
      taxRepo.create.mockReturnValue(tax);
      taxRepo.save.mockResolvedValue(tax);
      const result = await service.create({
        code: 'IVA',
        name: 'IMPUESTO AL VALOR AGREGADO',
        value: 21,
      });
      expect(result.code).toBe('IVA');
      expect(result.value).toBe(21);
    });

    it('should throw ConflictException if code already exists', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax());
      await expect(
        service.create({
          code: 'IVA',
          name: 'IMPUESTO AL VALOR AGREGADO',
          value: 21,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a tax value', async () => {
      const tax = mockTax();
      const updated = mockTax({ value: 10.5 });
      taxRepo.findOne.mockResolvedValueOnce(tax);
      taxRepo.merge.mockReturnValue(updated);
      taxRepo.save.mockResolvedValue(updated);
      const result = await service.update(1, { value: 10.5 });
      expect(result.value).toBe(10.5);
    });

    it('should throw ConflictException if new code already exists', async () => {
      taxRepo.findOne
        .mockResolvedValueOnce(mockTax({ code: 'IVA' }))
        .mockResolvedValueOnce(mockTax({ code: 'IIBB' }));
      await expect(service.update(1, { code: 'IIBB' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if tax not found', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete a tax with no product assignments', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(tax);
      productTaxRepo.findOne.mockResolvedValue(null);
      taxRepo.softDelete.mockResolvedValue({ affected: 1 });
      await service.delete(1);
      expect(taxRepo.softDelete).toHaveBeenCalledWith(tax.id);
    });

    it('should throw ConflictException if tax is assigned to products', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax());
      productTaxRepo.findOne.mockResolvedValue({
        id: 1,
        taxId: 1,
        productId: 5,
      });
      await expect(service.delete(1)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
