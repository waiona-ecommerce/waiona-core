import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ComboImageController } from '../../../products/combo-images/controllers/combo-image.controller';
import { ComboImageService } from '../../../products/combo-images/services/combo-image.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';

describe('ComboImageController', () => {
  let controller: ComboImageController;
  let service: jest.Mocked<ComboImageService>;

  const mockService = () => ({
    create: jest.fn(),
    findByCombo: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse = (overrides = {}) => ({
    id: 1,
    comboId: 1,
    url: 'https://img.com/combo1.jpg',
    position: 1,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComboImageController],
      providers: [
        { provide: ComboImageService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ComboImageController>(ComboImageController);
    service = module.get(ComboImageService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create should delegate to service', async () => {
    service.create.mockResolvedValue(mockResponse() as any);
    const result = await controller.create({
      comboId: 1,
      url: 'https://img.com/combo1.jpg',
      position: 1,
    });
    expect(service.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('findByCombo should delegate to service', async () => {
    service.findByCombo.mockResolvedValue([mockResponse() as any]);
    const result = await controller.findByCombo(1);
    expect(service.findByCombo).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });

  it('findOne should delegate to service', async () => {
    service.findOne.mockResolvedValue(mockResponse() as any);
    const result = await controller.findOne(1);
    expect(result.id).toBe(1);
  });

  it('update should delegate to service', async () => {
    service.update.mockResolvedValue(mockResponse({ position: 2 }) as any);
    const result = await controller.update(1, { position: 2 });
    expect(result.position).toBe(2);
  });

  it('remove should delegate to service', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
