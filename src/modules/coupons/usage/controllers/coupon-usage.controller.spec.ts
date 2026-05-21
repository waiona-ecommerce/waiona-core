import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CouponUsageController } from '../../../coupons/usage/controllers/coupon-usage.controller';
import { CouponUsageService } from '../../../coupons/usage/services/coupon-usage.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleType } from 'src/common/enums/role-type.enum';

describe('CouponUsageController', () => {
  let controller: CouponUsageController;
  let service: jest.Mocked<CouponUsageService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findByCoupon: jest.fn(),
    findByUser: jest.fn(),
  });
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

  const mockReq = (sub = 1, role = RoleType.ADMIN) =>
    ({ user: { sub, role } }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponUsageController],
      providers: [
        { provide: CouponUsageService, useFactory: mockService },
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
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should extract userId from JWT and delegate to service', async () => {
    const dto = { code: 'DESCUENTO10', orderId: 1 };
    service.create.mockResolvedValue(mockResponse());

    const result = await controller.create(dto, mockReq(1));

    expect(service.create).toHaveBeenCalledWith({ ...dto, userId: 1 });
    expect(result.couponId).toBe(1);
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
