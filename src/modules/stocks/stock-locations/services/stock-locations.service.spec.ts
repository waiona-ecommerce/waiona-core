import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { StockLocationsService } from '../../../stocks/stock-locations/services/stock-locations.service';
import { StockLocationEntity } from '../../../stocks/stock-locations/entities/stock-locations.entity';
import { StockLocationType } from '../../../stocks/stock-locations/enums/stock-location-type.enum';

describe('StockLocationsService', () => {
  let service: StockLocationsService;
  let repo: any;

  const mockRepo = () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), merge: jest.fn() });

  const mockLocation = (overrides = {}): StockLocationEntity =>
    ({ id: 1, name: 'Depósito Central', type: StockLocationType.WAREHOUSE,
       address: null, isDeleted: false, createdAt: new Date(), updatedAt: new Date(), ...overrides }) as unknown as StockLocationEntity;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StockLocationsService,
        { provide: getRepositoryToken(StockLocationEntity), useFactory: mockRepo },
      ],
    }).compile();
    service = module.get<StockLocationsService>(StockLocationsService);
    repo    = module.get(getRepositoryToken(StockLocationEntity));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a location', async () => {
      const loc = mockLocation();
      repo.create.mockReturnValue(loc);
      repo.save.mockResolvedValue(loc);
      expect((await service.create({ name: 'Depósito Central', type: StockLocationType.WAREHOUSE } as any)).name).toBe('Depósito Central');
    });
  });

  describe('findAll', () => {
    it('should return all locations', async () => {
      repo.find.mockResolvedValue([mockLocation()]);
      expect(await service.findAll()).toHaveLength(1);
    });

    it('should return empty array', async () => {
      repo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a location', async () => {
      repo.findOne.mockResolvedValue(mockLocation());
      expect((await service.findOne(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a location', async () => {
      const loc     = mockLocation();
      const updated = mockLocation({ name: 'Actualizado' });
      repo.findOne.mockResolvedValue(loc);
      repo.merge.mockReturnValue(updated);
      repo.save.mockResolvedValue(updated);
      expect((await service.update(1, { name: 'Actualizado' } as any)).name).toBe('Actualizado');
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete', async () => {
      const loc = mockLocation();
      repo.findOne.mockResolvedValue(loc);
      repo.save.mockResolvedValue({ ...loc, isDeleted: true });
      await service.remove(1);
      expect(repo.save).toHaveBeenCalledWith({ ...loc, isDeleted: true });
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});