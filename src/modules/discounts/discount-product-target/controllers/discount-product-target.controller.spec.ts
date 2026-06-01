import { Test, TestingModule } from '@nestjs/testing';
import { DiscountProductTargetController } from './discount-product-target.controller';
import { DiscountProductTargetService } from '../services/discount-product-target.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('DiscountProductTargetController', () => {
  let controller: DiscountProductTargetController;
  let service: jest.Mocked<DiscountProductTargetService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
  });

  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscountProductTargetController],
      providers: [
        { provide: DiscountProductTargetService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<DiscountProductTargetController>(
      DiscountProductTargetController,
    );
    service = module.get(DiscountProductTargetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockTargetResponse = (overrides = {}) => ({
    id: 1,
    discountId: 1,
    productId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a product target', async () => {
      const dto = { productId: 1 };
      const target = mockTargetResponse();
      service.create.mockResolvedValue(target);

      const result = await controller.create(1, dto);

      expect(service.create).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(target);
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return all targets for a discount', async () => {
      const targets = [mockTargetResponse()];
      service.findAll.mockResolvedValue(targets);

      const result = await controller.findAll(1);

      expect(service.findAll).toHaveBeenCalledWith(1);
      expect(result).toEqual(targets);
    });

    it('should return empty array if no targets', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(1);

      expect(result).toEqual([]);
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should remove a product target', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1, 1);

      expect(service.remove).toHaveBeenCalledWith(1, 1);
    });
  });
});
