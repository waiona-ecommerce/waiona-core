import { Test, TestingModule } from '@nestjs/testing';
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

  it('create should delegate to service', async () => {
    service.create.mockResolvedValue(mockResponse());
    const result = await controller.create({
      productId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 500,
      salePrice: 750,
    });
    expect(service.create).toHaveBeenCalled();
    expect(result.productId).toBe(1);
  });

  it('findAll should return all pricings', async () => {
    const paginated = { data: [mockResponse()], total: 1, page: 1, limit: 20 };
    service.findAll.mockResolvedValue(paginated as any);
    const result = await controller.findAll({});
    expect(result.data).toHaveLength(1);
  });

  it('findOne should delegate to service', async () => {
    service.findOne.mockResolvedValue(mockResponse());
    const result = await controller.findOne(1);
    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
  });

  it('findByProduct should delegate to service', async () => {
    service.findByProduct.mockResolvedValue(mockResponse());
    const result = await controller.findByProduct(1);
    expect(service.findByProduct).toHaveBeenCalledWith(1);
    expect(result.productId).toBe(1);
  });

  it('update should delegate to service', async () => {
    service.update.mockResolvedValue(mockResponse({ unitPrice: 600 }));
    const result = await controller.update(1, { unitPrice: 600 });
    expect(service.update).toHaveBeenCalledWith(1, { unitPrice: 600 });
    expect(result.unitPrice).toBe(600);
  });

  it('remove should delegate to service', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
