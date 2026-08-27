import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ComboPricingController } from './../controllers/combo-pricing.controller';
import { ComboPricingService } from './../services/combo-pricing.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';

describe('ComboPricingController', () => {
  let controller: ComboPricingController;
  let service: jest.Mocked<ComboPricingService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCombo: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse = (overrides = {}) => ({
    id: 1,
    comboId: 1,
    currency: CurrencyCode.ARS,
    unitPrice: 1200,
    salePrice: 1500,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockPaginated = (items: any[] = [mockResponse()]) => ({
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComboPricingController],
      providers: [
        { provide: ComboPricingService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ComboPricingController>(ComboPricingController);
    service = module.get(ComboPricingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = {
        comboId: 1,
        currency: CurrencyCode.ARS,
        unitPrice: 1200,
        salePrice: 1500,
      };
      const pricing = mockResponse();
      service.create.mockResolvedValue(pricing);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(pricing);
    });

    it('propagates BadRequestException when salePrice <= unitPrice', async () => {
      service.create.mockRejectedValueOnce(
        new BadRequestException(
          'El precio de venta debe ser mayor al precio de costo',
        ),
      );

      await expect(
        controller.create({
          comboId: 1,
          currency: CurrencyCode.ARS,
          unitPrice: 1500,
          salePrice: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates ConflictException when the combo already has pricing', async () => {
      service.create.mockRejectedValueOnce(
        new ConflictException('El combo ya tiene un pricing asignado'),
      );

      await expect(
        controller.create({
          comboId: 1,
          currency: CurrencyCode.ARS,
          unitPrice: 1200,
          salePrice: 1500,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when the combo does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new NotFoundException('Combo con id 999 no encontrado'),
      );

      await expect(
        controller.create({
          comboId: 999,
          currency: CurrencyCode.ARS,
          unitPrice: 1200,
          salePrice: 1500,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = mockPaginated();
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 2, limit: 10 });

      expect(service.findAll).toHaveBeenCalledWith(2, 10);
      expect(result).toBe(paginated);
    });

    it('returns empty data when there are no pricings', async () => {
      const paginated = mockPaginated([]);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // findByCombo
  // ==========================

  describe('findByCombo', () => {
    it('delegates to service.findByCombo', async () => {
      const pricing = mockResponse();
      service.findByCombo.mockResolvedValue(pricing);

      const result = await controller.findByCombo(1);

      expect(service.findByCombo).toHaveBeenCalledWith(1);
      expect(result).toBe(pricing);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findByCombo.mockRejectedValueOnce(
        new NotFoundException('Pricing de combo no encontrado'),
      );

      await expect(controller.findByCombo(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('delegates to service.findOne', async () => {
      const pricing = mockResponse();
      service.findOne.mockResolvedValue(pricing);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(pricing);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findOne.mockRejectedValueOnce(
        new NotFoundException('Pricing de combo no encontrado'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { salePrice: 1600 };
      const pricing = mockResponse({ salePrice: 1600 });
      service.update.mockResolvedValue(pricing);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(pricing);
    });

    it('propagates BadRequestException when salePrice <= unitPrice', async () => {
      service.update.mockRejectedValueOnce(
        new BadRequestException(
          'El precio de venta debe ser mayor al precio de costo',
        ),
      );

      await expect(controller.update(1, { salePrice: 100 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when not found', async () => {
      service.update.mockRejectedValueOnce(
        new NotFoundException('Pricing de combo no encontrado'),
      );

      await expect(controller.update(999, { salePrice: 1600 })).rejects.toThrow(
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
        new NotFoundException('Pricing de combo no encontrado'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
