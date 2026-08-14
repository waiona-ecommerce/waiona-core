import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProductTaxesController } from './product-taxes.controller';
import { ProductTaxesService } from '../services/product-taxes.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('ProductTaxesController', () => {
  let controller: ProductTaxesController;
  let service: jest.Mocked<ProductTaxesService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });

  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductTaxesController],
      providers: [
        { provide: ProductTaxesService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ProductTaxesController>(ProductTaxesController);
    service = module.get(ProductTaxesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockProductTaxResponse = (overrides = {}) => ({
    id: 1,
    productId: 1,
    taxId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return all product taxes for a productId', async () => {
      const tax = mockProductTaxResponse();
      const paginated = {
        data: [tax],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
      };
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(1, { page: 1, limit: 20 });

      expect(service.findAll).toHaveBeenCalledWith(1, 1, 20);
      expect(result.data).toEqual([tax]);
    });

    it('should return empty data if no taxes', async () => {
      const paginated = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
      };
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(1, { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a product tax by id', async () => {
      const tax = mockProductTaxResponse();
      service.findOne.mockResolvedValue(tax);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(tax);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findOne.mockRejectedValueOnce(
        new NotFoundException('Impuesto de producto con id 999 no encontrado'),
      );
      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a product tax', async () => {
      const dto = { taxId: 1 };
      const tax = mockProductTaxResponse();
      service.create.mockResolvedValue(tax);

      const result = await controller.create(1, dto);

      expect(service.create).toHaveBeenCalledWith({ taxId: 1, productId: 1 });
      expect(result).toEqual(tax);
    });

    it('propagates NotFoundException when the tax does not exist', async () => {
      const dto = { taxId: 999 };
      service.create.mockRejectedValueOnce(
        new NotFoundException('Impuesto con id 999 no encontrado'),
      );
      await expect(controller.create(1, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException when the tax is global', async () => {
      const dto = { taxId: 1 };
      service.create.mockRejectedValueOnce(
        new BadRequestException(
          'Un impuesto global no puede asignarse a un producto específico',
        ),
      );
      await expect(controller.create(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates ConflictException when the tax is already assigned', async () => {
      const dto = { taxId: 1 };
      service.create.mockRejectedValueOnce(
        new ConflictException('El impuesto 1 ya está asignado a este producto'),
      );
      await expect(controller.create(1, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a product tax', async () => {
      const dto = { taxId: 2 };
      const tax = mockProductTaxResponse({ taxId: 2 });
      service.update.mockResolvedValue(tax);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(tax);
    });

    it('propagates NotFoundException when the product tax does not exist', async () => {
      const dto = { taxId: 2 };
      service.update.mockRejectedValueOnce(
        new NotFoundException('Impuesto de producto con id 999 no encontrado'),
      );
      await expect(controller.update(999, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException when the new tax is global', async () => {
      const dto = { taxId: 2 };
      service.update.mockRejectedValueOnce(
        new BadRequestException(
          'Un impuesto global no puede asignarse a un producto específico',
        ),
      );
      await expect(controller.update(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates ConflictException when the new tax is already assigned', async () => {
      const dto = { taxId: 2 };
      service.update.mockRejectedValueOnce(
        new ConflictException('El impuesto 2 ya está asignado a este producto'),
      );
      await expect(controller.update(1, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should remove a product tax', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('propagates NotFoundException when not found', async () => {
      service.remove.mockRejectedValueOnce(
        new NotFoundException('Impuesto de producto con id 999 no encontrado'),
      );
      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
