import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TaxesController } from './taxes.controller';
import { TaxesService } from '../services/taxes.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('TaxesController', () => {
  let controller: TaxesController;
  let service: jest.Mocked<TaxesService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxesController],
      providers: [
        { provide: TaxesService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<TaxesController>(TaxesController);
    service = module.get(TaxesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockTaxResponse = (overrides = {}) => ({
    id: 1,
    code: 'IVA',
    name: 'IMPUESTO AL VALOR AGREGADO',
    value: 21,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('delegates to service.findAll with page and limit', async () => {
      const paginated = {
        data: [mockTaxResponse()],
        total: 1,
        page: 3,
        limit: 5,
        totalPages: 1,
        hasNextPage: false,
      };
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 3, limit: 5 });

      expect(service.findAll).toHaveBeenCalledWith(3, 5);
      expect(result).toBe(paginated);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('delegates to service.findById', async () => {
      const tax = mockTaxResponse();
      service.findById.mockResolvedValue(tax);

      const result = await controller.findOne(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(tax);
    });

    it('propagates NotFoundException from service', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException('Impuesto no encontrado'),
      );

      await expect(controller.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const dto = {
      code: 'IVA',
      name: 'IMPUESTO AL VALOR AGREGADO',
      value: 21,
    };

    it('delegates to service.create', async () => {
      const tax = mockTaxResponse();
      service.create.mockResolvedValue(tax);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(tax);
    });

    it('propagates ConflictException from service when code already exists', async () => {
      service.create.mockRejectedValue(
        new ConflictException('Ya existe un impuesto con el código "IVA"'),
      );

      await expect(controller.create(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { value: 15 };
      const tax = mockTaxResponse({ value: 15 });
      service.update.mockResolvedValue(tax);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(tax);
    });

    it('propagates NotFoundException from service', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Impuesto no encontrado'),
      );

      await expect(controller.update(1, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('delegates to service.delete', async () => {
      service.delete.mockResolvedValue(undefined);

      const result = await controller.remove(1);

      expect(service.delete).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException from service', async () => {
      service.delete.mockRejectedValue(
        new NotFoundException('Impuesto no encontrado'),
      );

      await expect(controller.remove(1)).rejects.toThrow(NotFoundException);
    });
  });
});
