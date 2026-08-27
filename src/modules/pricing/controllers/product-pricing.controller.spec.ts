import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ProductPricingController } from './../controllers/product-pricing.controller';
import { ProductPricingService } from './../services/product-pricing.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';

describe('ProductPricingController', () => {
  let controller: ProductPricingController;
  let service: jest.Mocked<ProductPricingService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByProduct: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse = (overrides = {}) => ({
    id: 1,
    productId: 1,
    currency: CurrencyCode.ARS,
    unitPrice: 500,
    salePrice: 750,
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
      controllers: [ProductPricingController],
      providers: [
        { provide: ProductPricingService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ProductPricingController>(ProductPricingController);
    service = module.get(ProductPricingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = {
        productId: 1,
        currency: CurrencyCode.ARS,
        unitPrice: 500,
        salePrice: 750,
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
          productId: 1,
          currency: CurrencyCode.ARS,
          unitPrice: 750,
          salePrice: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates ConflictException when the product already has pricing', async () => {
      service.create.mockRejectedValueOnce(
        new ConflictException('El producto ya tiene un pricing asignado'),
      );

      await expect(
        controller.create({
          productId: 1,
          currency: CurrencyCode.ARS,
          unitPrice: 500,
          salePrice: 750,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when the product does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new NotFoundException('Producto con id 999 no encontrado'),
      );

      await expect(
        controller.create({
          productId: 999,
          currency: CurrencyCode.ARS,
          unitPrice: 500,
          salePrice: 750,
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
  // findByProduct
  // ==========================

  describe('findByProduct', () => {
    it('delegates to service.findByProduct', async () => {
      const pricing = mockResponse();
      service.findByProduct.mockResolvedValue(pricing);

      const result = await controller.findByProduct(1);

      expect(service.findByProduct).toHaveBeenCalledWith(1);
      expect(result).toBe(pricing);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findByProduct.mockRejectedValueOnce(
        new NotFoundException('Pricing de producto no encontrado'),
      );

      await expect(controller.findByProduct(999)).rejects.toThrow(
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
        new NotFoundException('Pricing de producto no encontrado'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { salePrice: 900 };
      const pricing = mockResponse({ salePrice: 900 });
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
        new NotFoundException('Pricing de producto no encontrado'),
      );

      await expect(controller.update(999, { salePrice: 900 })).rejects.toThrow(
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
        new NotFoundException('Pricing de producto no encontrado'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
