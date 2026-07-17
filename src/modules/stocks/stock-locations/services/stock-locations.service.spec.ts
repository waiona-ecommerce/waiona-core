import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { StockLocationsService } from './stock-locations.service';
import { StockLocationEntity } from '../entities/stock-locations.entity';
import { StockItemEntity } from '../../stock-item/entities/stock-item.entity';
import { StockLocationType } from '../enums/stock-location-type.enum';

describe('StockLocationsService', () => {
  let service: StockLocationsService;
  let repo: any;
  let stockItemRepo: any;

  const mockRepo = () => ({
    count: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockStockItemRepo = () => ({ count: jest.fn() });

  const mockLocation = (overrides = {}): StockLocationEntity => ({
    id: 1,
    name: 'Depósito Central',
    type: StockLocationType.WAREHOUSE,
    address: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockLocationsService,
        {
          provide: getRepositoryToken(StockLocationEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(StockItemEntity),
          useFactory: mockStockItemRepo,
        },
      ],
    }).compile();
    service = module.get<StockLocationsService>(StockLocationsService);
    repo = module.get(getRepositoryToken(StockLocationEntity));
    stockItemRepo = module.get(getRepositoryToken(StockItemEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('creates a location when none exists', async () => {
      repo.count.mockResolvedValue(0);
      const loc = mockLocation();
      repo.create.mockReturnValue(loc);
      repo.save.mockResolvedValue(loc);
      const result = await service.create({
        name: 'Depósito Central',
        type: StockLocationType.WAREHOUSE,
      });
      expect(result.name).toBe('Depósito Central');
    });

    it('throws ConflictException when a location already exists', async () => {
      repo.count.mockResolvedValue(1);
      await expect(
        service.create({
          name: 'Segundo Depósito',
          type: StockLocationType.WAREHOUSE,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('queries with order and skip/take, and returns mapped data with pagination metadata', async () => {
      const loc = mockLocation();
      repo.findAndCount.mockResolvedValue([[loc], 25]);

      const result = await service.findAll(2, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(result.data[0]).toEqual(
        expect.objectContaining({ id: loc.id, name: loc.name }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
    });

    it('returns an empty paginated result when there are no locations', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasNextPage).toBe(false);
    });

    it('calculates skip from page and limit', async () => {
      repo.findAndCount.mockResolvedValue([[mockLocation()], 1]);

      await service.findAll(3, 5);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('returns a location', async () => {
      repo.findOne.mockResolvedValue(mockLocation());
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('updates a location', async () => {
      const loc = mockLocation();
      repo.findOne.mockResolvedValue(loc);
      repo.save.mockResolvedValue(mockLocation({ name: 'Actualizado' }));
      const result = await service.update(1, { name: 'Actualizado' });
      expect(result.name).toBe('Actualizado');
    });

    it('clears address when explicitly set to null', async () => {
      const loc = mockLocation({ address: 'Calle 123' });
      repo.findOne.mockResolvedValue(loc);
      repo.save.mockResolvedValue(mockLocation({ address: null }));
      const result = await service.update(1, { address: null });
      expect(result.address).toBeUndefined();
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('soft deletes a location with no stock items', async () => {
      repo.findOne.mockResolvedValue(mockLocation());
      stockItemRepo.count.mockResolvedValue(0);
      repo.softDelete.mockResolvedValue(undefined);
      await service.remove(1);
      expect(repo.softDelete).toHaveBeenCalledWith(1);
    });

    it('throws ConflictException when location has active stock items', async () => {
      repo.findOne.mockResolvedValue(mockLocation());
      stockItemRepo.count.mockResolvedValue(3);
      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
