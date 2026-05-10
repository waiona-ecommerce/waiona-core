import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { DiscountsController } from '../../discount/controllers/discounts.controller';
import { DiscountsService } from '../../discount/services/discounts.service';
import { RolesGuard } from 'src/common/guards/roles.guard';

describe('DiscountsController', () => {
  let controller: DiscountsController;
  let service: jest.Mocked<DiscountsService>;

  const mockService    = () => ({ create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() });
  const mockAuthGuard  = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse   = (overrides = {}) => ({ id: 1, name: 'Promo 10%', value: 10, isPercentage: true, createdAt: new Date(), updatedAt: new Date(), ...overrides });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DiscountsController],
      providers: [
        { provide: DiscountsService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt')).useValue(mockAuthGuard)
      .overrideGuard(RolesGuard).useValue(mockRolesGuard)
      .compile();

    controller = module.get<DiscountsController>(DiscountsController);
    service    = module.get(DiscountsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());
  it('create delegates', async () => { service.create.mockResolvedValue(mockResponse() as any); expect(await controller.create({} as any)).toBeDefined(); });
  it('findAll delegates', async () => { service.findAll.mockResolvedValue([mockResponse() as any]); expect(await controller.findAll()).toHaveLength(1); });
  it('findOne delegates', async () => { service.findOne.mockResolvedValue(mockResponse() as any); expect((await controller.findOne(1)).id).toBe(1); });
  it('update delegates', async () => { service.update.mockResolvedValue(mockResponse() as any); expect(await controller.update(1, {} as any)).toBeDefined(); });
  it('remove delegates', async () => { service.remove.mockResolvedValue(undefined); await controller.remove(1); expect(service.remove).toHaveBeenCalledWith(1); });
});