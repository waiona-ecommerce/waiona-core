import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ComboTaxesService } from './combo-taxes.service';
import { ComboTaxEntity } from '../entities/combo-taxes.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';

describe('ComboTaxesService', () => {
  let service: ComboTaxesService;
  let comboTaxRepo: any;
  let taxRepo: any;

  const mockComboTaxRepo = () => ({
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

  const mockComboTax = (overrides = {}): ComboTaxEntity =>
    ({
      id: 1,
      comboId: 1,
      taxId: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ComboTaxEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComboTaxesService,
        {
          provide: getRepositoryToken(ComboTaxEntity),
          useFactory: mockComboTaxRepo,
        },
        { provide: getRepositoryToken(TaxEntity), useFactory: mockTaxRepo },
      ],
    }).compile();

    service = module.get<ComboTaxesService>(ComboTaxesService);
    comboTaxRepo = module.get(getRepositoryToken(ComboTaxEntity));
    taxRepo = module.get(getRepositoryToken(TaxEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a combo tax', async () => {
      const ct = mockComboTax();
      taxRepo.findOne.mockResolvedValue(mockTax());
      comboTaxRepo.create.mockReturnValue(ct);
      comboTaxRepo.save.mockResolvedValue(ct);
      const result = await service.create({ comboId: 1, taxId: 1 });
      expect(result.comboId).toBe(1);
    });

    it('should throw NotFoundException if tax not found', async () => {
      taxRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ comboId: 1, taxId: 999 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if tax is global', async () => {
      taxRepo.findOne.mockResolvedValue(mockTax({ isGlobal: true }));
      await expect(
        service.create({ comboId: 1, taxId: 1 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all combo taxes by comboId', async () => {
      comboTaxRepo.find.mockResolvedValue([mockComboTax()]);
      expect(await service.findAll(1)).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a combo tax', async () => {
      comboTaxRepo.findOne.mockResolvedValue(mockComboTax());
      expect((await service.findOne(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      comboTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a combo tax', async () => {
      const ct = mockComboTax();
      const updated = mockComboTax({ taxId: 2 });
      comboTaxRepo.findOne.mockResolvedValue(ct);
      comboTaxRepo.merge.mockReturnValue(updated);
      comboTaxRepo.save.mockResolvedValue(updated);
      expect((await service.update(1, { taxId: 2 } as any)).taxId).toBe(2);
    });

    it('should throw NotFoundException', async () => {
      comboTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete', async () => {
      const ct = mockComboTax();
      comboTaxRepo.findOne.mockResolvedValue(ct);
      comboTaxRepo.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove(1);
      expect(comboTaxRepo.softDelete).toHaveBeenCalledWith(ct.id);
    });

    it('should throw NotFoundException', async () => {
      comboTaxRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
