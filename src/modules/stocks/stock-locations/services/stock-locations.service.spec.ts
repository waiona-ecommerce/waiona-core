import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { StockLocationsService } from './stock-locations.service';
import { StockLocationEntity } from '../entities/stock-locations.entity';
import { StockLocationType } from '../enums/stock-location-type.enum';

describe('StockLocationsService', () => {
  let service: StockLocationsService;
  let repo: any;

  const mockRepo = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  });

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
      ],
    }).compile();
    service = module.get<StockLocationsService>(StockLocationsService);
    repo = module.get(getRepositoryToken(StockLocationEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('creates a location', async () => {
      const loc = mockLocation();
      repo.create.mockReturnValue(loc);
      repo.save.mockResolvedValue(loc);
      const result = await service.create({
        name: 'Depósito Central',
        type: StockLocationType.WAREHOUSE,
      });
      expect(result.name).toBe('Depósito Central');
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('returns paginated locations', async () => {
      repo.findAndCount.mockResolvedValue([[mockLocation()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
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
    it('soft deletes a location', async () => {
      repo.findOne.mockResolvedValue(mockLocation());
      repo.softDelete.mockResolvedValue(undefined);
      await service.remove(1);
      expect(repo.softDelete).toHaveBeenCalledWith(1);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
