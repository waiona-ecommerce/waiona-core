import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { OrderCouponController } from './order-coupon.controller';
import { OrdersService } from '../services/orders.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RoleType } from '../../../common/enums/role-type.enum';

describe('OrderCouponController', () => {
  let controller: OrderCouponController;
  let ordersService: jest.Mocked<OrdersService>;

  const mockOrdersService = () => ({ applyCoupon: jest.fn() });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

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
      controllers: [OrderCouponController],
      providers: [
        { provide: OrdersService, useFactory: mockOrdersService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<OrderCouponController>(OrderCouponController);
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
});
