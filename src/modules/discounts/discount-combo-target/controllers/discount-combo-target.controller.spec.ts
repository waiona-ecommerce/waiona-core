import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { DiscountComboTargetController } from './discount-combo-target.controller';
import { DiscountComboTargetService } from '../services/discount-combo-target.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';

describe('DiscountComboTargetController', () => {
  let controller: DiscountComboTargetController;
  let service: jest.Mocked<DiscountComboTargetService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockTargetResponse = (overrides = {}) => ({
    id: 1,
    discountId: 1,
    comboId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscountComboTargetController],
      providers: [
        { provide: DiscountComboTargetService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<DiscountComboTargetController>(
      DiscountComboTargetController,
    );
    service = module.get(DiscountComboTargetService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  describe('create', () => {
    it('should create a combo target', async () => {
      const target = mockTargetResponse();
      service.create.mockResolvedValue(target);
      const result = await controller.create(1, { comboId: 1 });
      expect(service.create).toHaveBeenCalledWith(1, { comboId: 1 });
      expect(result).toEqual(target);
    });

    it('should propagate error from service', async () => {
      service.create.mockRejectedValue(new Error('boom'));
      await expect(controller.create(1, { comboId: 1 } as any)).rejects.toThrow(
        'boom',
      );
    });
  });

  describe('findAll', () => {
    it('should return all combo targets for a discount', async () => {
      const target = mockTargetResponse();
      const paginated = {
        data: [target],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
      };
      service.findAll.mockResolvedValue(paginated);
      const result = await controller.findAll(1, { page: 1, limit: 20 });
      expect(service.findAll).toHaveBeenCalledWith(1, 1, 20);
      expect(result.data).toEqual([target]);
    });

    it('should return empty data if no targets', async () => {
      const paginated = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
      };
      service.findAll.mockResolvedValue(paginated);
      expect(
        (await controller.findAll(1, { page: 1, limit: 20 })).data,
      ).toEqual([]);
    });

    it('should propagate error from service', async () => {
      service.findAll.mockRejectedValue(new Error('boom'));
      await expect(
        controller.findAll(1, { page: 1, limit: 20 }),
      ).rejects.toThrow('boom');
    });
  });

  describe('remove', () => {
    it('should remove a combo target', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove(1, 1);
      expect(service.remove).toHaveBeenCalledWith(1, 1);
    });

    it('should propagate error from service', async () => {
      service.remove.mockRejectedValue(new Error('boom'));
      await expect(controller.remove(1, 1)).rejects.toThrow('boom');
    });
  });
});
