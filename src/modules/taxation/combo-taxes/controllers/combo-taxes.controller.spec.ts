import { Test, TestingModule } from '@nestjs/testing';
import { ComboTaxesController } from './combo-taxes.controller';
import { ComboTaxesService } from '../services/combo-taxes.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('ComboTaxesController', () => {
  let controller: ComboTaxesController;
  let service: jest.Mocked<ComboTaxesService>;

  const mockService = () => ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });

  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComboTaxesController],
      providers: [
        { provide: ComboTaxesService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ComboTaxesController>(ComboTaxesController);
    service = module.get(ComboTaxesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockComboTaxResponse = (overrides = {}) => ({
    id: 1,
    comboId: 1,
    taxId: 1,
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
    it('should return all combo taxes for a comboId', async () => {
      const taxes = [mockComboTaxResponse()];
      service.findAll.mockResolvedValue(taxes);

      const result = await controller.findAll(1);

      expect(service.findAll).toHaveBeenCalledWith(1);
      expect(result).toEqual(taxes);
    });

    it('should return empty array if no taxes', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(1);

      expect(result).toEqual([]);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a combo tax by id', async () => {
      const tax = mockComboTaxResponse();
      service.findOne.mockResolvedValue(tax);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(tax);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a combo tax', async () => {
      const dto = { taxId: 1 };
      const tax = mockComboTaxResponse();
      service.create.mockResolvedValue(tax);

      const result = await controller.create(1, dto);

      expect(service.create).toHaveBeenCalledWith({ taxId: 1, comboId: 1 });
      expect(result).toEqual(tax);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a combo tax', async () => {
      const dto = { taxId: 2 };
      const tax = mockComboTaxResponse({ taxId: 2 });
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
    it('should remove a combo tax', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
