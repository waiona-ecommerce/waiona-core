import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
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

    it('propagates ConflictException when a location already exists', async () => {
      const dto = {
        name: 'Depósito Central',
        type: StockLocationType.WAREHOUSE,
      };
      service.create.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una ubicación de stock. Solo se permite una ubicación activa.',
        ),
      );
      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
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

    it('propagates NotFoundException when not found', async () => {
      service.findOne.mockRejectedValueOnce(
        new NotFoundException('Ubicación de stock con id 999 no encontrada'),
      );
      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
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

    it('propagates NotFoundException when not found', async () => {
      const dto = { name: 'Actualizado' };
      service.update.mockRejectedValueOnce(
        new NotFoundException('Ubicación de stock con id 999 no encontrada'),
      );
      await expect(controller.update(999, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove(1);
      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('propagates NotFoundException when not found', async () => {
      service.remove.mockRejectedValueOnce(
        new NotFoundException('Ubicación de stock con id 999 no encontrada'),
      );
      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the location has stock items assigned', async () => {
      service.remove.mockRejectedValueOnce(
        new ConflictException(
          'No se puede eliminar: la ubicación tiene 1 stock item(s) asignado(s)',
        ),
      );
      await expect(controller.remove(1)).rejects.toThrow(ConflictException);
    });
  });
});
