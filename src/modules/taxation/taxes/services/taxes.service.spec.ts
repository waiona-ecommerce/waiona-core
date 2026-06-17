import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TaxesService } from './taxes.service';
import { TaxEntity } from '../entities/tax.entity';
import { TaxTypeEntity } from '../../tax-types/entities/tax-types.entity';
describe('TaxesService', () => {
  let service: TaxesService;
  let taxRepo: any;
  let taxTypeRepo: any;

  const mockTaxRepo = () => ({
    find: jest.fn(),
    findAndCount: jest.fn(),
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
      isGlobal: false,
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
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      taxRepo.findAndCount.mockResolvedValue([[mockTax()], 1]);
      const result = await service.findAll(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].value).toBe(21);
      expect(result.total).toBe(1);
    });

    it('should return empty data when taxType exists but has no taxes', async () => {
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      taxRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll(1);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw NotFoundException if taxTypeId does not exist', async () => {
      taxTypeRepo.findOne.mockResolvedValue(null);
      await expect(service.findAll(999)).rejects.toThrow(NotFoundException);
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
    it('should create a tax', async () => {
      const tax = mockTax();
      taxTypeRepo.findOne.mockResolvedValue(mockTaxType());
      taxRepo.create.mockReturnValue(tax);
      taxRepo.save.mockResolvedValue(tax);
      taxRepo.findOne.mockResolvedValue(tax);

      const result = await service.create(1, { value: 21 });
      expect(result.value).toBe(21);
    });

    it('should throw NotFoundException if taxType not found', async () => {
      taxTypeRepo.findOne.mockResolvedValue(null);
      await expect(service.create(999, { value: 21 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // update
  // ==========================
  describe('update', () => {
    it('should update a tax', async () => {
      const tax = mockTax();
      const updated = mockTax({ value: 10.5 });
      taxRepo.findOne.mockResolvedValueOnce(tax).mockResolvedValueOnce(updated);
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
