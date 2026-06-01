import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { DiscountsController } from '../../discount/controllers/discounts.controller';
import { DiscountsService } from '../../discount/services/discounts.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { DiscountResponseDto } from '../dto/response-discount.dto';

describe('DiscountsController', () => {
  let controller: DiscountsController;
  let service: jest.Mocked<DiscountsService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = (overrides = {}) =>
    ({
      id: 1,
      name: 'Promo 10%',
      value: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as DiscountResponseDto;

  const mockPaginated = (items: DiscountResponseDto[] = [mockResponse()]) =>
    new PaginatedResponseDto(items, items.length, 1, 20);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DiscountsController],
      providers: [
        { provide: DiscountsService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<DiscountsController>(DiscountsController);
    service = module.get(DiscountsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create delegates', async () => {
    service.create.mockResolvedValue(mockResponse());
    expect(await controller.create({} as any)).toBeDefined();
  });

  it('findAll delegates and returns PaginatedResponseDto', async () => {
    const paginated = mockPaginated();
    service.findAll.mockResolvedValue(paginated);
    const result = await controller.findAll({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith(1, 20);
  });

  it('findOne delegates', async () => {
    service.findOne.mockResolvedValue(mockResponse());
    expect((await controller.findOne(1)).id).toBe(1);
  });

  it('update delegates', async () => {
    service.update.mockResolvedValue(mockResponse());
    expect(await controller.update(1, {} as any)).toBeDefined();
  });

  it('remove delegates', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
