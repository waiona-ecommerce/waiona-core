import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ComboController } from '../../../products/combos/controllers/combo.controller';
import { ComboService } from '../../../products/combos/services/combo.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

describe('ComboController', () => {
  let controller: ComboController;
  let service: jest.Mocked<ComboService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = (overrides = {}) => ({
    id: 1,
    name: 'Combo Coca x3',
    description: 'Tres Coca Cola',
    isActive: true,
    categoryId: 1,
    categoryName: 'Combos',
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComboController],
      providers: [
        { provide: ComboService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ComboController>(ComboController);
    service = module.get(ComboService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = new PaginatedResponseDto(
        [mockResponse() as any],
        1,
        2,
        10,
      );
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 2, limit: 10 });

      expect(service.findAll).toHaveBeenCalledWith(2, 10);
      expect(result).toBe(paginated);
    });

    it('returns empty data when there are no combos', async () => {
      const paginated = new PaginatedResponseDto([], 0, 1, 20);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({});

      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const combo = mockResponse();
      service.findById.mockResolvedValue(combo);

      const result = await controller.findById(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(combo);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findById.mockRejectedValueOnce(
        new NotFoundException('Combo con id 999 no encontrado'),
      );

      await expect(controller.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = {
        name: 'Combo',
        categoryId: 1,
        items: [{ productId: 1, quantity: 1 }],
      };
      const combo = mockResponse();
      service.create.mockResolvedValue(combo);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(combo);
    });

    it('propagates BadRequestException when the category does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new BadRequestException('Categoría con id 999 no encontrada'),
      );

      await expect(
        controller.create({ categoryId: 999 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates BadRequestException when an item product is invalid', async () => {
      service.create.mockRejectedValueOnce(
        new BadRequestException('Producto con id 1 no encontrado o inactivo'),
      );

      await expect(
        controller.create({ items: [{ productId: 1, quantity: 1 }] } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { name: 'Combo Actualizado' };
      const combo = mockResponse({ name: 'Combo Actualizado' });
      service.update.mockResolvedValue(combo);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(combo);
    });

    it('propagates NotFoundException when not found', async () => {
      service.update.mockRejectedValueOnce(
        new NotFoundException('Combo con id 999 no encontrado'),
      );

      await expect(controller.update(999, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException when the new category does not exist', async () => {
      service.update.mockRejectedValueOnce(
        new BadRequestException('Categoría con id 999 no encontrada'),
      );

      await expect(controller.update(1, { categoryId: 999 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates BadRequestException when replacing items with a duplicate productId', async () => {
      service.update.mockRejectedValueOnce(
        new BadRequestException('Producto con id 1 duplicado en el combo'),
      );

      await expect(
        controller.update(1, {
          items: [
            { productId: 1, quantity: 1 },
            { productId: 1, quantity: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // delete
  // ==========================

  describe('delete', () => {
    it('delegates to service.delete', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(1);

      expect(service.delete).toHaveBeenCalledWith(1);
    });

    it('propagates NotFoundException when not found', async () => {
      service.delete.mockRejectedValueOnce(
        new NotFoundException('Combo con id 999 no encontrado'),
      );

      await expect(controller.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the combo has dependents', async () => {
      service.delete.mockRejectedValueOnce(
        new ConflictException(
          'No se puede eliminar el combo: tiene 3 orden(es) que lo incluyen',
        ),
      );

      await expect(controller.delete(1)).rejects.toThrow(ConflictException);
    });
  });
});
