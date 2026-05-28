import { Test, TestingModule } from '@nestjs/testing';
import { MarginsController } from './margins.controller';
import { MarginsService } from '../services/margins.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('MarginsController', () => {
  let controller: MarginsController;
  let service: jest.Mocked<MarginsService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });

  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarginsController],
      providers: [
        { provide: MarginsService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<MarginsController>(MarginsController);
    service = module.get(MarginsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockMarginResponse = (overrides = {}) => ({
    id: 1,
    name: 'Margen estándar',
    value: 20,
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
    it('should create a margin', async () => {
      const dto = { name: 'Margen estándar', value: 20 };
      const margin = mockMarginResponse();
      service.create.mockResolvedValue(margin);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(margin);
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return all margins', async () => {
      const margins = [mockMarginResponse()];
      service.findAll.mockResolvedValue(margins as any);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(margins);
    });

    it('should return empty array if no margins', async () => {
      service.findAll.mockResolvedValue([] as any);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result).toEqual([]);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a margin by id', async () => {
      const margin = mockMarginResponse();
      service.findOne.mockResolvedValue(margin);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(margin);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a margin', async () => {
      const dto = { value: 30 };
      const margin = mockMarginResponse({ value: 30 });
      service.update.mockResolvedValue(margin);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(margin);
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should remove a margin', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
