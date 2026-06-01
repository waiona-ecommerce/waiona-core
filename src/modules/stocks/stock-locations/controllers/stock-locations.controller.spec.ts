import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { StockLocationsController } from './stock-locations.controller';
import { StockLocationsService } from '../services/stock-locations.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { StockLocationType } from '../enums/stock-location-type.enum';

describe('StockLocationsController', () => {
  let controller: StockLocationsController;
  let service: jest.Mocked<StockLocationsService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });

  const mockPaginated = (items: any[]) => ({
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
  });

  const mockLocationResponse = (overrides = {}) => ({
    id: 1,
    name: 'Depósito Central',
    type: StockLocationType.WAREHOUSE,
    address: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockLocationsController],
      providers: [
        { provide: StockLocationsService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StockLocationsController>(StockLocationsController);
    service = module.get(StockLocationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = {
        name: 'Depósito Central',
        type: StockLocationType.WAREHOUSE,
      };
      const loc = mockLocationResponse();
      service.create.mockResolvedValue(loc as any);
      const result = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(loc);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = mockPaginated([mockLocationResponse()]);
      service.findAll.mockResolvedValue(paginated);
      const result = await controller.findAll({ page: 1, limit: 20 });
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toBe(paginated);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne', async () => {
      const loc = mockLocationResponse();
      service.findOne.mockResolvedValue(loc as any);
      const result = await controller.findOne(1);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(loc);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { name: 'Actualizado' };
      const loc = mockLocationResponse({ name: 'Actualizado' });
      service.update.mockResolvedValue(loc as any);
      const result = await controller.update(1, dto);
      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(loc);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove(1);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
