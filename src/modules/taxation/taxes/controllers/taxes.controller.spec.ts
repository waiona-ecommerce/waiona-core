import { Test, TestingModule } from '@nestjs/testing';
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
    it('should return all taxes', async () => {
      const tax = mockTaxResponse();
      const paginated = {
        data: [tax],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
      };
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result.data).toEqual([tax]);
    });

    it('should return empty data if no taxes', async () => {
      const paginated = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
      };
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a tax by id', async () => {
      const tax = mockTaxResponse();
      service.findById.mockResolvedValue(tax);

      const result = await controller.findOne(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(tax);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a tax', async () => {
      const dto = {
        code: 'IVA',
        name: 'IMPUESTO AL VALOR AGREGADO',
        value: 21,
      };
      const tax = mockTaxResponse();
      service.create.mockResolvedValue(tax);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(tax);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a tax', async () => {
      const dto = { value: 15 };
      const tax = mockTaxResponse({ value: 15 });
      service.update.mockResolvedValue(tax);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(tax);
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should delete a tax', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.delete).toHaveBeenCalledWith(1);
    });
  });
});
