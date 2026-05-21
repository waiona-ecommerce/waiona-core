import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { CategoryController } from '../../../products/categories/controllers/category.controller';
import { CategoryService } from '../../../products/categories/services/category.service';
import { RolesGuard } from 'src/common/guards/roles.guard';

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

  describe('findAll', () => {
    it('should return all categories', async () => {
      service.findAll.mockResolvedValue([mockResponse() as any]);
      const result = await controller.findAll({});
      expect(service.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('getTree', () => {
    it('should return tree', async () => {
      service.getTree.mockResolvedValue([
        { id: 1, name: 'Bebidas', children: [] },
      ]);
      const result = await controller.getTree();
      expect(service.getTree).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a category by id', async () => {
      service.findById.mockResolvedValue(mockResponse());
      const result = await controller.findById(1);
      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      const dto = { name: 'Bebidas', isActive: true };
      service.create.mockResolvedValue(mockResponse());
      const result = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const dto = { name: 'Gaseosas' };
      service.update.mockResolvedValue(mockResponse({ name: 'Gaseosas' }));
      const result = await controller.update(1, dto);
      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result.name).toBe('Gaseosas');
    });
  });

  describe('delete', () => {
    it('should delete a category', async () => {
      service.delete.mockResolvedValue(undefined);
      await controller.delete(1);
      expect(service.delete).toHaveBeenCalledWith(1);
    });
  });
});
