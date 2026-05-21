import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ComboPricingController } from './../controllers/combo-pricing.controller';
import { ComboPricingService } from './../services/combo-pricing.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

describe('ComboPricingController', () => {
  let controller: ComboPricingController;
  let service: jest.Mocked<ComboPricingService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCombo: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse = (overrides = {}) => ({
    id: 1,
    comboId: 1,
    currency: CurrencyCode.ARS,
    unitPrice: 1200,
    marginId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComboPricingController],
      providers: [
        { provide: ComboPricingService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ComboPricingController>(ComboPricingController);
    service = module.get(ComboPricingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should delegate to service', async () => {
    service.create.mockResolvedValue(mockResponse());
    const result = await controller.create({
      comboId: 1,
      currency: CurrencyCode.ARS,
      unitPrice: 1200,
    });
    expect(service.create).toHaveBeenCalled();
    expect(result.comboId).toBe(1);
  });

  it('findAll should return all pricings', async () => {
    const paginated = { data: [mockResponse()], total: 1, page: 1, limit: 20 };
    service.findAll.mockResolvedValue(paginated as any);
    const result = await controller.findAll({});
    expect(result.data).toHaveLength(1);
  });

  it('findOne should delegate to service', async () => {
    service.findOne.mockResolvedValue(mockResponse());
    await controller.findOne(1);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it('findByCombo should delegate to service', async () => {
    service.findByCombo.mockResolvedValue(mockResponse());
    const result = await controller.findByCombo(1);
    expect(service.findByCombo).toHaveBeenCalledWith(1);
    expect(result.comboId).toBe(1);
  });

  it('update should delegate to service', async () => {
    service.update.mockResolvedValue(mockResponse({ unitPrice: 1500 }));
    const result = await controller.update(1, { unitPrice: 1500 });
    expect(result.unitPrice).toBe(1500);
  });

  it('remove should delegate to service', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
