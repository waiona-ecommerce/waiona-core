import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { StockItemsController } from './stock-item.controller';
import { StockItemsService } from '../services/stock-item.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { StockWriteOffReason } from '../../stock-writeoff/enums/stock-writeoff-reason.enum';

describe('StockItemsController', () => {
  let controller: StockItemsController;
  let service: jest.Mocked<StockItemsService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    addStock: jest.fn(),
    writeOff: jest.fn(),
    writeOffDamage: jest.fn(),
    dispatchStock: jest.fn(),
    releaseReservation: jest.fn(),
    updateThresholds: jest.fn(),
  });

  const mockPaginated = (items: any[]) => ({
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
  });

  const mockItemResponse = (overrides = {}) => ({
    id: 1,
    productId: 1,
    locationId: 1,
    locationName: 'Depósito',
    quantityCurrent: 20,
    quantityReserved: 5,
    quantityAvailable: 15,
    stockMin: 5,
    stockCritical: 2,
    stockMax: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockItemWithMovements = (overrides = {}) => ({
    ...mockItemResponse(),
    movements: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockItemsController],
      providers: [
        { provide: StockItemsService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StockItemsController>(StockItemsController);
    service = module.get(StockItemsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = mockPaginated([mockItemResponse()]);
      service.findAll.mockResolvedValue(paginated);
      const result = await controller.findAll({ page: 1, limit: 20 });
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toBe(paginated);
    });
  });

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const item = mockItemWithMovements();
      service.findById.mockResolvedValue(item);
      const result = await controller.findById(1);
      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(item);
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = {
        productId: 1,
        locationId: 1,
        stockMin: 5,
        stockCritical: 2,
      };
      const item = mockItemResponse();
      service.create.mockResolvedValue(item);
      const result = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(item);
    });
  });

  describe('addStock', () => {
    it('delegates to service.addStock with productId, locationId, quantity', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 10 };
      const item = mockItemWithMovements();
      service.addStock.mockResolvedValue(item);
      const result = await controller.addStock(dto);
      expect(service.addStock).toHaveBeenCalledWith(1, 1, 10);
      expect(result).toBe(item);
    });
  });

  describe('writeOff', () => {
    it('delegates to service.writeOff with stockItemId, quantity', async () => {
      const dto = { stockItemId: 1, quantity: 5 };
      const item = mockItemWithMovements();
      service.writeOff.mockResolvedValue(item);
      const result = await controller.writeOff(dto);
      expect(service.writeOff).toHaveBeenCalledWith(1, 5);
      expect(result).toBe(item);
    });
  });

  describe('writeOffDamage', () => {
    it('delegates to service.writeOffDamage', async () => {
      const dto = {
        stockItemId: 1,
        quantity: 2,
        reason: StockWriteOffReason.DAMAGED,
        reportedBy: 99,
      };
      const item = mockItemWithMovements();
      service.writeOffDamage.mockResolvedValue(item);
      const result = await controller.writeOffDamage(dto);
      expect(service.writeOffDamage).toHaveBeenCalledWith(dto);
      expect(result).toBe(item);
    });
  });

  describe('dispatchStock', () => {
    it('delegates to service.dispatchStock', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.dispatchStock.mockResolvedValue(undefined);
      await controller.dispatchStock(dto);
      expect(service.dispatchStock).toHaveBeenCalledWith(1, 1, 3, 10);
    });
  });

  describe('releaseReservation', () => {
    it('delegates to service.releaseReservation', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.releaseReservation.mockResolvedValue(undefined);
      await controller.releaseReservation(dto);
      expect(service.releaseReservation).toHaveBeenCalledWith(1, 1, 3, 10);
    });
  });

  describe('updateThresholds', () => {
    it('delegates to service.updateThresholds', async () => {
      const dto = { stockMin: 10, stockCritical: 3, stockMax: 200 };
      const item = mockItemResponse(dto);
      service.updateThresholds.mockResolvedValue(item);
      const result = await controller.updateThresholds(1, dto);
      expect(service.updateThresholds).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(item);
    });
  });
});
