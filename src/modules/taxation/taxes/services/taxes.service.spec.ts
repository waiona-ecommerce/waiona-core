import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { TaxesService } from './taxes.service';
import { TaxEntity } from '../entities/tax.entity';
import { ProductTaxEntity } from '../../product-taxes/entities/product-taxes.entity';
import { TaxResponseDto } from '../dto/tax-response.dto';

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
    it('paginates using skip/take derived from page and limit', async () => {
      taxRepo.findAndCount.mockResolvedValue([[mockTax()], 1]);

      const result = await service.findAll(3, 5);

      expect(taxRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 5,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toBeInstanceOf(TaxResponseDto);
      expect(result.data[0].code).toBe('IVA');
      expect(result.total).toBe(1);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(5);
    });

    it('should return empty page', async () => {
      taxRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
    });
  });

  describe('findById', () => {
    it('maps the entity to TaxResponseDto', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(tax);

      const result = await service.findById(1);

      expect(taxRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toBeInstanceOf(TaxResponseDto);
      expect(result.id).toBe(tax.id);
      expect(result.code).toBe(tax.code);
      expect(result.value).toBe(21);
    });

    it('coerces the decimal value (returned as string by pg) to a number', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax({ value: '21.50' as any }));

      const result = await service.findById(1);

      expect(result.value).toBe(21.5);
    });

    it('should throw NotFoundException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      code: 'IVA',
      name: 'IMPUESTO AL VALOR AGREGADO',
      value: 21,
    };

    it('creates the tax when the code does not exist yet, defaulting isGlobal to false', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(null);
      taxRepo.create.mockReturnValue(tax);
      taxRepo.save.mockResolvedValue(tax);

      const result = await service.create(dto);

      expect(taxRepo.findOne).toHaveBeenCalledWith({
        where: { code: dto.code },
      });
      expect(taxRepo.create).toHaveBeenCalledWith({
        ...dto,
        isGlobal: false,
      });
      expect(taxRepo.save).toHaveBeenCalledWith(tax);
      expect(result).toBeInstanceOf(TaxResponseDto);
      expect(result.code).toBe('IVA');
    });

    it('respects isGlobal when explicitly provided', async () => {
      const tax = mockTax({ isGlobal: true });
      taxRepo.findOne.mockResolvedValue(null);
      taxRepo.create.mockReturnValue(tax);
      taxRepo.save.mockResolvedValue(tax);

      await service.create({ ...dto, isGlobal: true });

      expect(taxRepo.create).toHaveBeenCalledWith({
        ...dto,
        isGlobal: true,
      });
    });

    it('throws ConflictException without creating when code already exists', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(taxRepo.create).not.toHaveBeenCalled();
      expect(taxRepo.save).not.toHaveBeenCalled();
    });

    it('converts a DB unique violation (race condition) into ConflictException', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      taxRepo.create.mockReturnValue(mockTax());
      taxRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], new Error('duplicate key')),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('rethrows unexpected DB errors as-is', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      taxRepo.create.mockReturnValue(mockTax());
      taxRepo.save.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(dto)).rejects.toThrow('connection lost');
    });
  });

  describe('update', () => {
    it('updates without checking code uniqueness when code is not changed', async () => {
      const tax = mockTax();
      const updated = mockTax({ value: 10.5 });
      taxRepo.findOne.mockResolvedValue(tax);
      taxRepo.merge.mockReturnValue(updated);
      taxRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, { value: 10.5 });

      expect(taxRepo.findOne).toHaveBeenCalledTimes(1);
      expect(taxRepo.merge).toHaveBeenCalledWith(tax, { value: 10.5 });
      expect(result).toBeInstanceOf(TaxResponseDto);
      expect(result.value).toBe(10.5);
    });

    it('skips the uniqueness check when code is set to its current value', async () => {
      const tax = mockTax({ code: 'IVA' });
      taxRepo.findOne.mockResolvedValue(tax);
      taxRepo.merge.mockReturnValue(tax);
      taxRepo.save.mockResolvedValue(tax);

      await service.update(1, { code: 'IVA' });

      expect(taxRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException without saving if the new code already exists', async () => {
      taxRepo.findOne
        .mockResolvedValueOnce(mockTax({ code: 'IVA' }))
        .mockResolvedValueOnce(mockTax({ code: 'IIBB' }));

      await expect(service.update(1, { code: 'IIBB' })).rejects.toThrow(
        ConflictException,
      );
      expect(taxRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException without merging or saving', async () => {
      taxRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(taxRepo.merge).not.toHaveBeenCalled();
      expect(taxRepo.save).not.toHaveBeenCalled();
    });

    it('converts a DB unique violation (race condition) into ConflictException', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(tax);
      taxRepo.merge.mockReturnValue(tax);
      taxRepo.save.mockRejectedValue(
        new QueryFailedError('UPDATE', [], new Error('duplicate key')),
      );

      await expect(service.update(1, { value: 5 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows unexpected DB errors as-is', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(tax);
      taxRepo.merge.mockReturnValue(tax);
      taxRepo.save.mockRejectedValue(new Error('connection lost'));

      await expect(service.update(1, { value: 5 })).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('delete', () => {
    it('soft deletes when the tax has no product assignments', async () => {
      const tax = mockTax();
      taxRepo.findOne.mockResolvedValue(tax);
      productTaxRepo.findOne.mockResolvedValue(null);
      taxRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete(1);

      expect(productTaxRepo.findOne).toHaveBeenCalledWith({
        where: { taxId: tax.id },
      });
      expect(taxRepo.softDelete).toHaveBeenCalledWith(tax.id);
    });

    it('throws ConflictException without deleting when assigned to a product', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax());
      productTaxRepo.findOne.mockResolvedValue({
        id: 1,
        taxId: 1,
        productId: 5,
      });

      await expect(service.delete(1)).rejects.toThrow(ConflictException);
      expect(taxRepo.softDelete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException without checking product assignments', async () => {
      taxRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
      expect(productTaxRepo.findOne).not.toHaveBeenCalled();
      expect(taxRepo.softDelete).not.toHaveBeenCalled();
    });
  });
});
