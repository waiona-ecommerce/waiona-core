import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProductTaxesService } from './product-taxes.service';
import { ProductTaxEntity } from '../entities/product-taxes.entity';
import { TaxEntity } from '../../taxes/entities/tax.entity';
describe('ProductTaxesService', () => {
  let service: ProductTaxesService;
  let productTaxRepo: any;
  let taxRepo: any;

  const mockProductTaxRepo = () => ({
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });
  const mockTaxRepo = () => ({ findOne: jest.fn() });

  const mockTax = (overrides = {}) => ({
    id: 1,
    taxTypeId: 1,
    value: 21,
    isGlobal: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockProductTax = (overrides = {}): ProductTaxEntity =>
    ({
      id: 1,
      productId: 1,
      taxId: 1,
      tax: mockTax(),
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
    it('should create a product tax and return tax details', async () => {
      const pt = mockProductTax();
      taxRepo.findOne.mockResolvedValue(mockTax());
      productTaxRepo.findOne
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce(pt);  // findEntity after save
      productTaxRepo.create.mockReturnValue(pt);
      productTaxRepo.save.mockResolvedValue(pt);
      const result = await service.create({ productId: 1, taxId: 1 });
      expect(result.productId).toBe(1);
      expect(result.taxId).toBe(1);
      expect(result.tax).toBeDefined();
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

    it('should throw ConflictException if tax already assigned to product', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax());
      productTaxRepo.findOne.mockResolvedValue(mockProductTax()); // ya existe
      await expect(
        service.create({ productId: 1, taxId: 1 } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all product taxes by productId', async () => {
      productTaxRepo.findAndCount.mockResolvedValue([[mockProductTax()], 1]);
      const result = await service.findAll(1);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should include tax details in response', async () => {
      productTaxRepo.findAndCount.mockResolvedValue([[mockProductTax()], 1]);
      const result = await service.findAll(1);
      expect(result.data[0].tax).toBeDefined();
      expect(result.data[0].tax?.value).toBe(21);
    });
  });

  describe('findOne', () => {
    it('should return a product tax with tax details', async () => {
      productTaxRepo.findOne.mockResolvedValue(mockProductTax());
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
      expect(result.tax).toBeDefined();
      expect(result.tax?.value).toBe(21);
    });

    it('should throw NotFoundException', async () => {
      productTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a product tax and return tax details', async () => {
      const pt = mockProductTax();
      const updated = mockProductTax({ taxId: 2, tax: mockTax({ id: 2 }) });
      productTaxRepo.findOne
        .mockResolvedValueOnce(pt)      // findEntity (inicial)
        .mockResolvedValueOnce(null)    // duplicate check
        .mockResolvedValueOnce(updated); // findEntity después de save
      taxRepo.findOne.mockResolvedValue(mockTax({ id: 2 }));
      productTaxRepo.merge.mockReturnValue(updated);
      productTaxRepo.save.mockResolvedValue(updated);
      const result = await service.update(1, { taxId: 2 } as any);
      expect(result.taxId).toBe(2);
      expect(result.tax).toBeDefined();
    });

    it('should skip validations when taxId is unchanged', async () => {
      const pt = mockProductTax({ taxId: 1 });
      productTaxRepo.findOne
        .mockResolvedValueOnce(pt)  // findEntity (inicial)
        .mockResolvedValueOnce(pt); // findEntity después de save
      productTaxRepo.merge.mockReturnValue(pt);
      productTaxRepo.save.mockResolvedValue(pt);
      await service.update(1, { taxId: 1 } as any);
      expect(taxRepo.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if productTax not found', async () => {
      productTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if new tax does not exist', async () => {
      productTaxRepo.findOne.mockResolvedValueOnce(mockProductTax());
      taxRepo.findOne.mockResolvedValue(null);
      await expect(service.update(1, { taxId: 2 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if new tax is global', async () => {
      productTaxRepo.findOne.mockResolvedValueOnce(mockProductTax());
      taxRepo.findOne.mockResolvedValue(mockTax({ isGlobal: true }));
      await expect(service.update(1, { taxId: 2 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if new tax already assigned to product', async () => {
      productTaxRepo.findOne
        .mockResolvedValueOnce(mockProductTax())  // findEntity
        .mockResolvedValueOnce(mockProductTax({ taxId: 2 })); // duplicate check
      taxRepo.findOne.mockResolvedValue(mockTax({ id: 2 }));
      await expect(service.update(1, { taxId: 2 } as any)).rejects.toThrow(
        ConflictException,
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
