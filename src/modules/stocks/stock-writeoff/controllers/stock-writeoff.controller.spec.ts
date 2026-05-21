import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { StockWriteOffController } from './stock-writeoff.controller';
import { StockWriteOffService } from '../services/stock-writeoff.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { StockWriteOffReason } from '../enums/stock-writeoff-reason.enum';

describe('StockWriteOffController', () => {
  let controller: StockWriteOffController;
  let service: jest.Mocked<StockWriteOffService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByStockItemId: jest.fn(),
    update: jest.fn(),
  });

  const mockPaginated = (items: any[]) => ({
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
  });

  const mockWriteOffResponse = (overrides = {}) => ({
    id: 1,
    stockItemId: 1,
    movementId: 10,
    quantity: 3,
    reason: StockWriteOffReason.DAMAGED,
    description: undefined,
    attachments: undefined,
    reportedBy: 99,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockWriteOffController],
      providers: [
        { provide: StockWriteOffService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StockWriteOffController>(StockWriteOffController);
    service = module.get(StockWriteOffService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = mockPaginated([mockWriteOffResponse()]);
      service.findAll.mockResolvedValue(paginated);
      const result = await controller.findAll({ page: 1, limit: 20 });
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toBe(paginated);
    });
  });

  describe('findByStockItemId', () => {
    it('delegates to service.findByStockItemId', async () => {
      const writeOffs = [mockWriteOffResponse()];
      service.findByStockItemId.mockResolvedValue(writeOffs);
      const result = await controller.findByStockItemId(1);
      expect(service.findByStockItemId).toHaveBeenCalledWith(1);
      expect(result).toBe(writeOffs);
    });
  });

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const writeOff = mockWriteOffResponse();
      service.findById.mockResolvedValue(writeOff);
      const result = await controller.findById(1);
      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(writeOff);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = {
        reason: StockWriteOffReason.EXPIRED,
        description: 'vencido',
      };
      const writeOff = mockWriteOffResponse({
        reason: StockWriteOffReason.EXPIRED,
      });
      service.update.mockResolvedValue(writeOff);
      const result = await controller.update(1, dto);
      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(writeOff);
    });
  });
});
