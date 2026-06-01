import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CouponController } from '../../../coupons/coupon/controllers/coupon.controller';
import { CouponService } from '../../../coupons/coupon/services/coupon.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CouponStatus } from '../../../coupons/coupon/enums/coupon-status.enum';

describe('CouponController', () => {
  let controller: CouponController;
  let service: jest.Mocked<CouponService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = (overrides = {}) => ({
    id: 1,
    code: 'DESCUENTO10',
    value: 10,
    isGlobal: true,
    usageLimit: 100,
    usageCount: 0,
    status: CouponStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponController],
      providers: [
        { provide: CouponService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CouponController>(CouponController);
    service = module.get(CouponService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should delegate to service', async () => {
    const dto = {
      code: 'DESCUENTO10',
      value: 10,
      isGlobal: true,
    };
    service.create.mockResolvedValue(mockResponse() as any);
    const result = await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result.code).toBe('DESCUENTO10');
  });

  it('findAll should return paginated coupons', async () => {
    const paginated = { data: [mockResponse()], total: 1, page: 1, limit: 20 };
    service.findAll.mockResolvedValue(paginated as any);

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith(1, 20);
    expect(result.data).toHaveLength(1);
  });

  it('findOne should return a coupon', async () => {
    service.findOne.mockResolvedValue(mockResponse() as any);
    const result = await controller.findOne(1);
    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
  });

  it('update should delegate to service', async () => {
    service.update.mockResolvedValue(mockResponse({ usageLimit: 200 }) as any);
    const result = await controller.update(1, { usageLimit: 200 });
    expect(service.update).toHaveBeenCalledWith(1, { usageLimit: 200 });
    expect(result.usageLimit).toBe(200);
  });

  it('remove should delegate to service', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
