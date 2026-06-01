import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ProductImageController } from '../../../products/product-images/controllers/product-image.controller';
import { ProductImageService } from '../../../products/product-images/services/product-image.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';

describe('ProductImageController', () => {
  let controller: ProductImageController;
  let service: jest.Mocked<ProductImageService>;

  const mockService = () => ({
    create: jest.fn(),
    findByProduct: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse = (overrides = {}) => ({
    id: 1,
    productId: 1,
    url: 'https://img.com/1.jpg',
    position: 1,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductImageController],
      providers: [
        { provide: ProductImageService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ProductImageController>(ProductImageController);
    service = module.get(ProductImageService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should delegate to service', async () => {
    const dto = { productId: 1, url: 'https://img.com/1.jpg', position: 1 };
    service.create.mockResolvedValue(mockResponse() as any);
    const result = await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBeDefined();
  });

  it('findByProduct should delegate to service', async () => {
    service.findByProduct.mockResolvedValue([mockResponse() as any]);
    const result = await controller.findByProduct(1);
    expect(service.findByProduct).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });

  it('findOne should delegate to service', async () => {
    service.findOne.mockResolvedValue(mockResponse() as any);
    const result = await controller.findOne(1);
    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
  });

  it('update should delegate to service', async () => {
    service.update.mockResolvedValue(mockResponse({ position: 2 }) as any);
    const result = await controller.update(1, { position: 2 });
    expect(service.update).toHaveBeenCalledWith(1, { position: 2 });
    expect(result.position).toBe(2);
  });

  it('remove should delegate to service', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
