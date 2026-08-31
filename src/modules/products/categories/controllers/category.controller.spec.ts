import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CategoryController } from '../../../products/categories/controllers/category.controller';
import { CategoryService } from '../../../products/categories/services/category.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: jest.Mocked<CategoryService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getTree: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = (overrides = {}) => ({
    id: 1,
    name: 'Bebidas',
    description: 'Bebidas',
    isActive: true,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        { provide: CategoryService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get(CategoryService);
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

    it('returns empty data when there are no categories', async () => {
      const paginated = new PaginatedResponseDto([], 0, 1, 20);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({});

      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // getTree
  // ==========================

  describe('getTree', () => {
    it('delegates to service.getTree', async () => {
      const tree = [{ id: 1, name: 'Bebidas', children: [] }];
      service.getTree.mockResolvedValue(tree);

      const result = await controller.getTree();

      expect(service.getTree).toHaveBeenCalled();
      expect(result).toBe(tree);
    });

    it('returns an empty array when there are no categories', async () => {
      service.getTree.mockResolvedValue([]);

      const result = await controller.getTree();

      expect(result).toEqual([]);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const category = mockResponse();
      service.findById.mockResolvedValue(category);

      const result = await controller.findById(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(category);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findById.mockRejectedValueOnce(
        new NotFoundException('Categoría con id 999 no encontrada'),
      );

      await expect(controller.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = { name: 'Bebidas' };
      const category = mockResponse();
      service.create.mockResolvedValue(category);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(category);
    });

    it('propagates BadRequestException when parentId does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new BadRequestException('Categoría padre con id 99 no encontrada'),
      );

      await expect(
        controller.create({ name: 'Sub', parentId: 99 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates ConflictException when the name already exists', async () => {
      service.create.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una categoría con el nombre "BEBIDAS"',
        ),
      );

      await expect(controller.create({ name: 'Bebidas' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { name: 'Gaseosas' };
      const category = mockResponse({ name: 'Gaseosas' });
      service.update.mockResolvedValue(category);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(category);
    });

    it('propagates NotFoundException when not found', async () => {
      service.update.mockRejectedValueOnce(
        new NotFoundException('Categoría con id 999 no encontrada'),
      );

      await expect(
        controller.update(999, { name: 'Gaseosas' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the new name already exists', async () => {
      service.update.mockRejectedValueOnce(
        new ConflictException('Ya existe una categoría con el nombre "NUEVO"'),
      );

      await expect(controller.update(1, { name: 'Nuevo' })).rejects.toThrow(
        ConflictException,
      );
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
        new NotFoundException('Categoría con id 999 no encontrada'),
      );

      await expect(controller.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the category has dependents', async () => {
      service.delete.mockRejectedValueOnce(
        new ConflictException(
          'No se puede eliminar la categoría: tiene 2 producto(s) asignado(s)',
        ),
      );

      await expect(controller.delete(1)).rejects.toThrow(ConflictException);
    });
  });
});
