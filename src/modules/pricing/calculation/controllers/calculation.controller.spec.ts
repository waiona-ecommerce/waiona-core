import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CalculationController } from '../../calculation/controllers/calculation.controller';
import { CalculationService } from '../../calculation/services/calculation.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';

describe('CalculationController', () => {
  let controller: CalculationController;
  let service: jest.Mocked<CalculationService>;

  const mockService = () => ({
    preview: jest.fn(),
    calculateProduct: jest.fn(),
    calculateCombo: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockBreakdown = (overrides = {}) => ({
    unitPrice: 500,
    discount: 50,
    priceAfterDiscount: 450,
    margin: 90,
    priceAfterMargin: 540,
    taxes: 113.4,
    finalPrice: 653.4,
    fullPrice: 726,
    coupon: 0,
    orderTotal: 653.4,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalculationController],
      providers: [
        { provide: CalculationService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CalculationController>(CalculationController);
    service = module.get(CalculationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('preview should delegate to service', () => {
    service.preview.mockReturnValue(mockBreakdown());
    const dto = { unitPrice: 500, marginValue: 20 };
    const result = controller.preview(dto);
    expect(service.preview).toHaveBeenCalledWith(dto);
    expect(result.unitPrice).toBe(500);
  });

  it('calculateProduct should delegate to service', async () => {
    service.calculateProduct.mockResolvedValue(mockBreakdown());
    const dto = { productId: 1 };
    const result = await controller.calculateProduct(dto);
    expect(service.calculateProduct).toHaveBeenCalledWith(dto);
    expect(result.finalPrice).toBe(653.4);
  });

  it('calculateProduct should return coupon=0 and orderTotal=finalPrice', async () => {
    service.calculateProduct.mockResolvedValue(mockBreakdown());
    const result = await controller.calculateProduct({ productId: 1 });
    expect(result.coupon).toBe(0);
    expect(result.orderTotal).toBe(result.finalPrice);
  });

  it('calculateCombo should delegate to service', async () => {
    service.calculateCombo.mockResolvedValue(
      mockBreakdown({ unitPrice: 1200, finalPrice: 1742.4 }),
    );
    const dto = { comboId: 1 };
    const result = await controller.calculateCombo(dto);
    expect(service.calculateCombo).toHaveBeenCalledWith(dto);
    expect(result.unitPrice).toBe(1200);
  });
});
