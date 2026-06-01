import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CouponProductTargetController } from '../../../coupons/coupon-product-target/controllers/coupon-product-target.controller';
import { CouponProductTargetService } from '../../../coupons/coupon-product-target/services/coupon-product-target.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';

describe('CouponProductTargetController', () => {
  let controller: CouponProductTargetController;
  let service: jest.Mocked<CouponProductTargetService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse = (overrides = {}) => ({
    id: 1,
    couponId: 1,
    productId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponProductTargetController],
      providers: [
        { provide: CouponProductTargetService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CouponProductTargetController>(
      CouponProductTargetController,
    );
    service = module.get(CouponProductTargetService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should delegate to service', async () => {
    service.create.mockResolvedValue(mockResponse());
    const result = await controller.create(1, { productId: 1 });
    expect(service.create).toHaveBeenCalledWith(1, { productId: 1 });
    expect(result.productId).toBe(1);
  });

  it('findAll should return targets', async () => {
    service.findAll.mockResolvedValue([mockResponse()]);
    const result = await controller.findAll(1);
    expect(service.findAll).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });

  it('remove should delegate to service', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(1, 1);
    expect(service.remove).toHaveBeenCalledWith(1, 1);
  });
});
