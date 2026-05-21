import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CouponComboTargetController } from '../../../coupons/coupon-combo-target/controllers/coupon-combo-target.controller';
import { CouponComboTargetService } from '../../../coupons/coupon-combo-target/services/coupon-combo-target.service';
import { RolesGuard } from 'src/common/guards/roles.guard';

describe('CouponComboTargetController', () => {
  let controller: CouponComboTargetController;
  let service: jest.Mocked<CouponComboTargetService>;

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
    comboId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponComboTargetController],
      providers: [
        { provide: CouponComboTargetService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CouponComboTargetController>(
      CouponComboTargetController,
    );
    service = module.get(CouponComboTargetService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should delegate to service', async () => {
    service.create.mockResolvedValue(mockResponse());
    const result = await controller.create(1, { comboId: 1 });
    expect(service.create).toHaveBeenCalledWith(1, { comboId: 1 });
    expect(result.comboId).toBe(1);
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
