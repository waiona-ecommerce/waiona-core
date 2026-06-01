import { Test, TestingModule } from '@nestjs/testing';
import { MarginsService } from './margins.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MarginEntity } from '../entities/margin.entity';
import { ProductPricingEntity } from '../../pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from '../../pricing/entities/combo-pricing.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ShopCacheService } from '../../../common/cache/shop-cache.service';

describe('MarginsService', () => {
  let service: MarginsService;
  let marginRepository: any;
  let productPricingRepository: any;
  let comboPricingRepository: any;

  const mockRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockMargin = (overrides = {}): MarginEntity => ({
    id: 1,
    name: 'Margen estándar',
    value: 20,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockShopCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarginsService,
        { provide: getRepositoryToken(MarginEntity), useFactory: mockRepo },
        {
          provide: getRepositoryToken(ProductPricingEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(ComboPricingEntity),
          useFactory: mockRepo,
        },
        { provide: ShopCacheService, useValue: mockShopCacheService },
      ],
    }).compile();

    service = module.get<MarginsService>(MarginsService);
    marginRepository = module.get(getRepositoryToken(MarginEntity));
    productPricingRepository = module.get(
      getRepositoryToken(ProductPricingEntity),
    );
    comboPricingRepository = module.get(getRepositoryToken(ComboPricingEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a margin', async () => {
      const dto = { name: 'Margen estándar', value: 20 };
      const entity = mockMargin();

      marginRepository.findOne.mockResolvedValue(null);
      marginRepository.create.mockReturnValue(entity);
      marginRepository.save.mockResolvedValue(entity);

      const result = await service.create(dto);

      expect(marginRepository.create).toHaveBeenCalledWith(dto);
      expect(marginRepository.save).toHaveBeenCalledWith(entity);
      expect(result.name).toBe('Margen estándar');
      expect(result.value).toBe(20);
    });

    it('should throw ConflictException if name already exists', async () => {
      marginRepository.findOne.mockResolvedValue(mockMargin());

      await expect(
        service.create({ name: 'Margen estándar', value: 20 } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return paginated margins', async () => {
      const entities = [mockMargin()];
      marginRepository.findAndCount.mockResolvedValue([entities, 1]);

      const result = await service.findAll(1, 20);

      expect(marginRepository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should return empty page when no margins', async () => {
      marginRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(1, 20);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a margin by id', async () => {
      marginRepository.findOne.mockResolvedValue(mockMargin());

      const result = await service.findOne(1);

      expect(marginRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if not found', async () => {
      marginRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a margin', async () => {
      const entity = mockMargin();
      const updated = mockMargin({ value: 30 });

      marginRepository.findOne.mockResolvedValue(entity);
      marginRepository.merge.mockReturnValue(updated);
      marginRepository.save.mockResolvedValue(updated);

      const result = await service.update(1, { value: 30 });

      expect(marginRepository.merge).toHaveBeenCalledWith(entity, {
        value: 30,
      });
      expect(result.value).toBe(30);
    });

    it('should throw NotFoundException if not found', async () => {
      marginRepository.findOne.mockResolvedValue(null);

      await expect(service.update(1, { value: 30 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if new name already taken', async () => {
      const entity = mockMargin({ name: 'Viejo' });
      const existing = mockMargin({ id: 2, name: 'Nuevo' });

      marginRepository.findOne
        .mockResolvedValueOnce(entity)
        .mockResolvedValueOnce(existing);

      await expect(service.update(1, { name: 'Nuevo' } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should soft delete a margin', async () => {
      const entity = mockMargin();

      marginRepository.findOne.mockResolvedValue(entity);
      productPricingRepository.findOne.mockResolvedValue(null);
      comboPricingRepository.findOne.mockResolvedValue(null);
      marginRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(1);

      expect(marginRepository.softDelete).toHaveBeenCalledWith(entity.id);
    });

    it('should throw NotFoundException if not found', async () => {
      marginRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if margin is used by a product pricing', async () => {
      marginRepository.findOne.mockResolvedValue(mockMargin());
      productPricingRepository.findOne.mockResolvedValue({ id: 5 });
      comboPricingRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if margin is used by a combo pricing', async () => {
      marginRepository.findOne.mockResolvedValue(mockMargin());
      productPricingRepository.findOne.mockResolvedValue(null);
      comboPricingRepository.findOne.mockResolvedValue({ id: 7 });

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });
  });
});
