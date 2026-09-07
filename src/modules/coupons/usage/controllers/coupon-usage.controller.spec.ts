import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CouponUsageController } from '../../../coupons/usage/controllers/coupon-usage.controller';
import { CouponUsageService } from '../../../coupons/usage/services/coupon-usage.service';
import { OrdersService } from '../../../orders/services/orders.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { RoleType } from '../../../../common/enums/role-type.enum';

describe('CouponUsageController', () => {
  let controller: CouponUsageController;
  let service: jest.Mocked<CouponUsageService>;
  let ordersService: jest.Mocked<OrdersService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findByCoupon: jest.fn(),
    findByUser: jest.fn(),
  });
  const mockOrdersService = () => ({ applyCoupon: jest.fn() });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = (overrides = {}) => ({
    id: 1,
    couponId: 1,
    orderId: 1,
    userId: 1,
    appliedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockOrderResponse = (overrides = {}) => ({
    id: 1,
    userId: 1,
    couponCode: 'DESCUENTO10',
    couponDiscount: 65.34,
    total: 588.06,
    ...overrides,
  });

  const mockJwt = (sub = 1, role = RoleType.CLIENT) => ({ sub, role });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponUsageController],
      providers: [
        { provide: CouponUsageService, useFactory: mockService },
        { provide: OrdersService, useFactory: mockOrdersService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CouponUsageController>(CouponUsageController);
    service = module.get(CouponUsageService);
    ordersService = module.get(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should delegate to OrdersService.applyCoupon with userId from JWT', async () => {
    const dto = { code: 'DESCUENTO10', orderId: 1 };
    ordersService.applyCoupon.mockResolvedValue(mockOrderResponse() as any);

    const result = await controller.create(dto, mockJwt(1));

    expect(ordersService.applyCoupon).toHaveBeenCalledWith(1, 'DESCUENTO10', 1);
    expect(result.couponDiscount).toBe(65.34);
  });

  it('findAll should return paginated usages', async () => {
    const paginated = { data: [mockResponse()], total: 1, page: 1, limit: 20 };
    service.findAll.mockResolvedValue(paginated as any);

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith(1, 20);
    expect(result.data).toHaveLength(1);
  });

  it('findByCoupon should delegate to service', async () => {
    service.findByCoupon.mockResolvedValue([mockResponse()]);
    const result = await controller.findByCoupon(1);
    expect(service.findByCoupon).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });

  it('findByUser should delegate to service', async () => {
    service.findByUser.mockResolvedValue([mockResponse()]);
    const result = await controller.findByUser(1);
    expect(service.findByUser).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });
});
