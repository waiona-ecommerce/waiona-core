import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { ProductController } from './product.controller';
import { ProductService } from '../services/product.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { ProductMeasurementUnit } from '../enums/product-measurement-unit.enum';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

describe('ProductController', () => {
  let controller: ProductController;
  let service: jest.Mocked<ProductService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ProductController>(ProductController);
    service = module.get(ProductService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockProductResponse = (overrides = {}) => ({
    id: 1,
    sku: 'COCA-500',
    name: 'Coca Cola 500ml',
    description: 'Gaseosa negra 500ml',
    isActive: true,
    categoryId: 1,
    categoryName: 'Bebidas',
    measurementUnit: ProductMeasurementUnit.UNIT,
    measurementValue: 500,
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
    it('delegates to service.findAll with page and limit', async () => {
      const products = [mockProductResponse()];
      const paginated = new PaginatedResponseDto(products, 1, 2, 10);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 2, limit: 10 });

      expect(service.findAll).toHaveBeenCalledWith(2, 10);
      expect(result).toBe(paginated);
    });

    it('returns empty data when there are no products', async () => {
      const paginated = new PaginatedResponseDto([], 0, 1, 20);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({});

      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const product = mockProductResponse();
      service.findById.mockResolvedValue(product);

      const result = await controller.findById(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(product);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findById.mockRejectedValueOnce(
        new NotFoundException('Producto con id 999 no encontrado'),
      );

      await expect(controller.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = { sku: 'COCA-500', name: 'Coca Cola 500ml', categoryId: 1 };
      const product = mockProductResponse();
      service.create.mockResolvedValue(product);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(product);
    });

    it('propagates BadRequestException when the category does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new BadRequestException('Categoría con id 999 no encontrada'),
      );

      await expect(
        controller.create({ categoryId: 999 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates ConflictException when the SKU already exists', async () => {
      service.create.mockRejectedValueOnce(
        new ConflictException('Ya existe un producto con el SKU COCA-500'),
      );

      await expect(
        controller.create({ sku: 'COCA-500' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { name: 'Coca Cola 1L' };
      const product = mockProductResponse({ name: 'Coca Cola 1L' });
      service.update.mockResolvedValue(product);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(product);
    });

    it('propagates NotFoundException when not found', async () => {
      service.update.mockRejectedValueOnce(
        new NotFoundException('Producto con id 999 no encontrado'),
      );

      await expect(controller.update(999, { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException when the new category does not exist', async () => {
      service.update.mockRejectedValueOnce(
        new BadRequestException('Categoría con id 999 no encontrada'),
      );

      await expect(controller.update(1, { categoryId: 999 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates ConflictException when the new SKU already exists', async () => {
      service.update.mockRejectedValueOnce(
        new ConflictException('Ya existe un producto con el SKU SPRITE-500'),
      );

      await expect(controller.update(1, { sku: 'SPRITE-500' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // delete
  // ==========================

  describe('delete', () => {
    it('delegates to service.delete', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(1);

      expect(service.delete).toHaveBeenCalledWith(1);
    });

    it('propagates NotFoundException when not found', async () => {
      service.delete.mockRejectedValueOnce(
        new NotFoundException('Producto con id 999 no encontrado'),
      );

      await expect(controller.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the product has dependents', async () => {
      service.delete.mockRejectedValueOnce(
        new ConflictException(
          'No se puede eliminar el producto: tiene 3 orden(es) que lo incluyen',
        ),
      );

      await expect(controller.delete(1)).rejects.toThrow(ConflictException);
    });
  });
});
