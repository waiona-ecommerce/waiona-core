import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductTaxesService } from './product-taxes.service';
import { ProductTaxEntity } from '../entities/product-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';

describe('ProductTaxesService', () => {
  let service: ProductTaxesService;
  let productTaxRepo: any;
  let taxRepo: any;

  const mockProductTaxRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockTaxRepo = () => ({ findOne: jest.fn() });

  const mockTax = (overrides = {}) => ({
    id: 1,
    isGlobal: false,
    deletedAt: null,
    ...overrides,
  });

  const mockProductTax = (overrides = {}): ProductTaxEntity =>
    ({
      id: 1,
      productId: 1,
      taxId: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ProductTaxEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductTaxesService,
        {
          provide: getRepositoryToken(ProductTaxEntity),
          useFactory: mockProductTaxRepo,
        },
        { provide: getRepositoryToken(TaxEntity), useFactory: mockTaxRepo },
      ],
    }).compile();

    service = module.get<ProductTaxesService>(ProductTaxesService);
    productTaxRepo = module.get(getRepositoryToken(ProductTaxEntity));
    taxRepo = module.get(getRepositoryToken(TaxEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a product tax', async () => {
      const pt = mockProductTax();
      taxRepo.findOne.mockResolvedValue(mockTax());
      productTaxRepo.create.mockReturnValue(pt);
      productTaxRepo.save.mockResolvedValue(pt);
      const result = await service.create({ productId: 1, taxId: 1 });
      expect(result.productId).toBe(1);
      expect(result.taxId).toBe(1);
    });

    it('should throw NotFoundException if tax not found', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ productId: 1, taxId: 999 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if tax is global', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax({ isGlobal: true }));
      await expect(
        service.create({ productId: 1, taxId: 1 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all product taxes by productId', async () => {
      productTaxRepo.find.mockResolvedValue([mockProductTax()]);
      expect(await service.findAll(1)).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a product tax', async () => {
      productTaxRepo.findOne.mockResolvedValue(mockProductTax());
      expect((await service.findOne(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      productTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a product tax', async () => {
      const pt = mockProductTax();
      const updated = mockProductTax({ taxId: 2 });
      productTaxRepo.findOne.mockResolvedValue(pt);
      productTaxRepo.merge.mockReturnValue(updated);
      productTaxRepo.save.mockResolvedValue(updated);
      expect((await service.update(1, { taxId: 2 } as any)).taxId).toBe(2);
    });

    it('should throw NotFoundException', async () => {
      productTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete', async () => {
      const pt = mockProductTax();
      productTaxRepo.findOne.mockResolvedValue(pt);
      productTaxRepo.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove(1);
      expect(productTaxRepo.softDelete).toHaveBeenCalledWith(pt.id);
    });

    it('should throw NotFoundException', async () => {
      productTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
