import { Test, TestingModule } from '@nestjs/testing';
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
    it('should return all products', async () => {
      const products = [mockProductResponse()];
      const paginated = new PaginatedResponseDto(products, 1, 1, 20);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({});

      expect(service.findAll).toHaveBeenCalled();
      expect(result.data).toEqual(products);
    });

    it('should return empty array if no products', async () => {
      const paginated = new PaginatedResponseDto([], 0, 1, 20) as any;
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({});

      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('should return a product by id', async () => {
      const product = mockProductResponse();
      service.findById.mockResolvedValue(product);

      const result = await controller.findById(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(product);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a product', async () => {
      const dto = { sku: 'COCA-500', name: 'Coca Cola 500ml', categoryId: 1 };
      const product = mockProductResponse();
      service.create.mockResolvedValue(product);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(product);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a product', async () => {
      const dto = { name: 'Coca Cola 1L' };
      const product = mockProductResponse({ name: 'Coca Cola 1L' });
      service.update.mockResolvedValue(product);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(product);
    });
  });

  // ==========================
  // delete
  // ==========================

  describe('delete', () => {
    it('should delete a product', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(1);

      expect(service.delete).toHaveBeenCalledWith(1);
    });
  });
});
