import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { StockItemsController } from './stock-item.controller';
import { StockItemsService } from '../services/stock-item.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { StockWriteOffReason } from '../../stock-writeoff/enums/stock-writeoff-reason.enum';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { JwtPayload } from '../../../../common/decorators/current-user.decorator';

describe('StockItemsController', () => {
  let controller: StockItemsController;
  let service: jest.Mocked<StockItemsService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    addStock: jest.fn(),
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
    productName: 'CAFÉ TOSTADO',
    locationId: 1,
    locationName: 'Depósito',
    quantityCurrent: 20,
    quantityReserved: 5,
    quantityAvailable: 15,
    stockMin: 5,
    stockCritical: 2,
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
      const result = await controller.findAll({ page: 3, limit: 5 });
      expect(service.findAll).toHaveBeenCalledWith(3, 5);
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

    it('propagates NotFoundException from service', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException('Stock item not found'),
      );
      await expect(controller.findById(1)).rejects.toThrow(NotFoundException);
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

    it('propagates ConflictException when the stock item already exists for that product and location', async () => {
      const dto = {
        productId: 1,
        locationId: 1,
        stockMin: 5,
        stockCritical: 2,
      };
      const item = mockItemResponse();
      service.create.mockResolvedValueOnce(item);
      await controller.create(dto);

      service.create.mockRejectedValueOnce(
        new ConflictException(
          'Stock item already exists for this product and location',
        ),
      );
      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });

    it('propagates BadRequestException on invalid thresholds', async () => {
      const dto = {
        productId: 1,
        locationId: 1,
        stockMin: 2,
        stockCritical: 5,
      };
      service.create.mockRejectedValueOnce(
        new BadRequestException('Invalid thresholds'),
      );
      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
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

    it('propagates BadRequestException on invalid quantity', async () => {
      const dto = { productId: 1, locationId: 1, quantity: -5 };
      service.addStock.mockRejectedValueOnce(
        new BadRequestException('La cantidad debe ser mayor a 0'),
      );
      await expect(controller.addStock(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when the stock item does not exist', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 10 };
      service.addStock.mockRejectedValueOnce(
        new NotFoundException('Stock item not found'),
      );
      await expect(controller.addStock(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('writeOff', () => {
    it('delegates to service.writeOffDamage with dto and reportedBy from JWT', async () => {
      const dto = {
        stockItemId: 1,
        quantity: 5,
        reason: StockWriteOffReason.INVENTORY_ERROR,
      };
      const mockUser: JwtPayload = { sub: 7, role: RoleType.ADMIN };
      const item = mockItemWithMovements();
      service.writeOffDamage.mockResolvedValue(item);
      const result = await controller.writeOff(dto, mockUser);
      expect(service.writeOffDamage).toHaveBeenCalledWith(dto, 7);
      expect(result).toBe(item);
    });

    it('propagates BadRequestException on invalid quantity or insufficient stock', async () => {
      const dto = {
        stockItemId: 1,
        quantity: 5,
        reason: StockWriteOffReason.INVENTORY_ERROR,
      };
      const mockUser: JwtPayload = { sub: 7, role: RoleType.ADMIN };
      service.writeOffDamage.mockRejectedValueOnce(
        new BadRequestException('La cantidad debe ser mayor a 0'),
      );
      await expect(controller.writeOff(dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when the stock item does not exist', async () => {
      const dto = {
        stockItemId: 1,
        quantity: 5,
        reason: StockWriteOffReason.INVENTORY_ERROR,
      };
      const mockUser: JwtPayload = { sub: 7, role: RoleType.ADMIN };
      service.writeOffDamage.mockRejectedValueOnce(
        new NotFoundException('Stock con id 1 no encontrado'),
      );
      await expect(controller.writeOff(dto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('dispatchStock', () => {
    it('delegates to service.dispatchStock', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.dispatchStock.mockResolvedValue(undefined);
      await controller.dispatchStock(dto);
      expect(service.dispatchStock).toHaveBeenCalledWith(1, 1, 3, 10);
    });

    it('propagates BadRequestException on insufficient reserved or current stock', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.dispatchStock.mockRejectedValueOnce(
        new BadRequestException(
          'No se pueden despachar 3 unidades — solo 1 reservadas para el producto 1',
        ),
      );
      await expect(controller.dispatchStock(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when the stock item does not exist', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.dispatchStock.mockRejectedValueOnce(
        new NotFoundException('Stock no encontrado para el producto 1'),
      );
      await expect(controller.dispatchStock(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('releaseReservation', () => {
    it('delegates to service.releaseReservation', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.releaseReservation.mockResolvedValue(undefined);
      await controller.releaseReservation(dto);
      expect(service.releaseReservation).toHaveBeenCalledWith(1, 1, 3, 10);
    });

    it('propagates BadRequestException on insufficient reserved stock', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.releaseReservation.mockRejectedValueOnce(
        new BadRequestException(
          'No se pueden liberar 3 unidades — solo 1 reservadas para el producto 1',
        ),
      );
      await expect(controller.releaseReservation(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when the stock item does not exist', async () => {
      const dto = { productId: 1, locationId: 1, quantity: 3, orderId: 10 };
      service.releaseReservation.mockRejectedValueOnce(
        new NotFoundException('Stock no encontrado para el producto 1'),
      );
      await expect(controller.releaseReservation(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateThresholds', () => {
    it('delegates to service.updateThresholds', async () => {
      const dto = { stockMin: 10, stockCritical: 3 };
      const item = mockItemResponse(dto);
      service.updateThresholds.mockResolvedValue(item);
      const result = await controller.updateThresholds(1, dto);
      expect(service.updateThresholds).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(item);
    });

    it('propagates BadRequestException on invalid threshold values', async () => {
      const dto = { stockMin: 2, stockCritical: 5 };
      service.updateThresholds.mockRejectedValueOnce(
        new BadRequestException('Invalid threshold values'),
      );
      await expect(controller.updateThresholds(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when the stock item does not exist', async () => {
      const dto = { stockMin: 10, stockCritical: 3 };
      service.updateThresholds.mockRejectedValueOnce(
        new NotFoundException('Stock con id 1 no encontrado'),
      );
      await expect(controller.updateThresholds(1, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
