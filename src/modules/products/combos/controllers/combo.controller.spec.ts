import { Test, TestingModule } from '@nestjs/testing';
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

  describe('findAll', () => {
    it('should return all combos', async () => {
      const paginated = new PaginatedResponseDto(
        [mockResponse() as any],
        1,
        1,
        20,
      );
      service.findAll.mockResolvedValue(paginated);
      const result = await controller.findAll({});
      expect(service.findAll).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a combo by id', async () => {
      service.findById.mockResolvedValue(mockResponse());
      const result = await controller.findById(1);
      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });
  });

  describe('create', () => {
    it('should create a combo', async () => {
      const dto = { name: 'Combo', categoryId: 1, items: [] };
      service.create.mockResolvedValue(mockResponse());
      const result = await controller.create(dto as any);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a combo', async () => {
      const dto = { name: 'Combo Actualizado' };
      service.update.mockResolvedValue(
        mockResponse({ name: 'Combo Actualizado' }),
      );
      const result = await controller.update(1, dto);
      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result.name).toBe('Combo Actualizado');
    });
  });

  describe('delete', () => {
    it('should delete a combo', async () => {
      service.delete.mockResolvedValue(undefined);
      await controller.delete(1);
      expect(service.delete).toHaveBeenCalledWith(1);
    });
  });
});
