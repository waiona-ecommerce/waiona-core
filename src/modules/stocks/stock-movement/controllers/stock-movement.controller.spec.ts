import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { StockMovementController } from './stock-movement.controller';
import { StockMovementService } from '../services/stock-movement.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { StockOperationType } from '../enums/stock-operation-type.enum';
import { StockFlow } from '../enums/stock-flow.enum';
import { StockReferenceType } from '../enums/stock-reference.enum';

describe('StockMovementController', () => {
  let controller: StockMovementController;
  let service: jest.Mocked<StockMovementService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByStockItemId: jest.fn(),
  });

  const mockPaginated = (items: any[]) => ({
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
  });

  const mockMovementResponse = (overrides = {}) => ({
    id: 1,
    stockItemId: 1,
    operationType: StockOperationType.ENTRY,
    stockFlow: StockFlow.INBOUND,
    quantity: 10,
    referenceType: StockReferenceType.MANUAL,
    referenceId: undefined,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockMovementController],
      providers: [
        { provide: StockMovementService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StockMovementController>(StockMovementController);
    service = module.get(StockMovementService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = mockPaginated([mockMovementResponse()]);
      service.findAll.mockResolvedValue(paginated);
      const result = await controller.findAll({ page: 1, limit: 20 });
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toBe(paginated);
    });
  });

  describe('findByStockItemId', () => {
    it('delegates to service.findByStockItemId', async () => {
      const movements = [mockMovementResponse()];
      service.findByStockItemId.mockResolvedValue(movements);
      const result = await controller.findByStockItemId(1);
      expect(service.findByStockItemId).toHaveBeenCalledWith(1);
      expect(result).toBe(movements);
    });
  });

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const movement = mockMovementResponse();
      service.findById.mockResolvedValue(movement);
      const result = await controller.findById(1);
      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(movement);
    });
  });
});
