import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { DiscountsController } from '../../discount/controllers/discounts.controller';
import { DiscountsService } from '../../discount/services/discounts.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { DiscountResponseDto } from '../dto/response-discount.dto';

describe('DiscountsController', () => {
  let controller: DiscountsController;
  let service: jest.Mocked<DiscountsService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = (overrides = {}) =>
    ({
      id: 1,
      name: 'PROMO 10%',
      value: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as DiscountResponseDto;

  const mockPaginated = (items: DiscountResponseDto[] = [mockResponse()]) =>
    new PaginatedResponseDto(items, items.length, 1, 20);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DiscountsController],
      providers: [
        { provide: DiscountsService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<DiscountsController>(DiscountsController);
    service = module.get(DiscountsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = { name: 'PROMO 10%', value: 10 };
      const discount = mockResponse();
      service.create.mockResolvedValue(discount);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(discount);
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = mockPaginated();
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toBe(paginated);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('delegates to service.findOne', async () => {
      const discount = mockResponse();
      service.findOne.mockResolvedValue(discount);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(discount);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findOne.mockRejectedValueOnce(
        new NotFoundException('Descuento con id 999 no encontrado'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { value: 15 };
      const discount = mockResponse({ value: 15 });
      service.update.mockResolvedValue(discount);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(discount);
    });

    it('propagates NotFoundException when not found', async () => {
      service.update.mockRejectedValueOnce(
        new NotFoundException('Descuento con id 999 no encontrado'),
      );

      await expect(controller.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('propagates NotFoundException when not found', async () => {
      service.remove.mockRejectedValueOnce(
        new NotFoundException('Descuento con id 999 no encontrado'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
