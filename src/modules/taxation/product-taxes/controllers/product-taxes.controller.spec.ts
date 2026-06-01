import { Test, TestingModule } from '@nestjs/testing';
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
      const taxes = [mockProductTaxResponse()];
      service.findAll.mockResolvedValue(taxes);

      const result = await controller.findAll(1);

      expect(service.findAll).toHaveBeenCalledWith(1);
      expect(result).toEqual(taxes);
    });

    it('should return empty array if no taxes', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(1);

      expect(result).toEqual([]);
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
  });
});
