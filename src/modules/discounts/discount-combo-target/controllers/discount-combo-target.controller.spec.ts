import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
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

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a combo target', async () => {
      const dto = { comboId: 1 };
      const target = mockTargetResponse();
      service.create.mockResolvedValue(target);

      const result = await controller.create(1, dto);

      expect(service.create).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(target);
    });

    it('propagates NotFoundException when the discount does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new NotFoundException('Descuento con id 999 no encontrado'),
      );

      await expect(controller.create(999, { comboId: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates ConflictException when the combo already has an assigned discount', async () => {
      service.create.mockRejectedValueOnce(
        new ConflictException('El combo 1 ya tiene un descuento asignado'),
      );

      await expect(controller.create(1, { comboId: 1 })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // findAll
  // ==========================

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
      expect(result).toBe(paginated);
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

      const result = await controller.findAll(1, { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
    });

    it('propagates NotFoundException when the discount does not exist', async () => {
      service.findAll.mockRejectedValueOnce(
        new NotFoundException('Descuento con id 999 no encontrado'),
      );

      await expect(
        controller.findAll(999, { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should remove a combo target', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1, 1);

      expect(service.remove).toHaveBeenCalledWith(1, 1);
    });

    it('propagates NotFoundException when not found', async () => {
      service.remove.mockRejectedValueOnce(
        new NotFoundException('El combo 999 no está asignado al descuento 1'),
      );

      await expect(controller.remove(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
