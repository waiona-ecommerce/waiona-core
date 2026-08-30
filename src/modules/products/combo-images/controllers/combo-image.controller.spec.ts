import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
    uploadImage: jest.fn(),
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
  const mockFile = {
    buffer: Buffer.from('img'),
    mimetype: 'image/jpeg',
    originalname: 'test.jpg',
  } as Express.Multer.File;

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

  // ==========================
  // uploadImage
  // ==========================

  describe('uploadImage', () => {
    const dto = { comboId: 1, position: 1 };

    it('delegates to service.uploadImage', async () => {
      const image = mockResponse();
      service.uploadImage.mockResolvedValue(image as any);

      const result = await controller.uploadImage(mockFile, dto);

      expect(service.uploadImage).toHaveBeenCalledWith(mockFile, dto);
      expect(result).toBe(image);
    });

    it('throws BadRequestException when no file is provided', () => {
      expect(() => controller.uploadImage(undefined as any, dto)).toThrow(
        BadRequestException,
      );
      expect(service.uploadImage).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when the combo does not exist', async () => {
      service.uploadImage.mockRejectedValueOnce(
        new NotFoundException('Combo con id 99 no encontrado'),
      );

      await expect(
        controller.uploadImage(mockFile, { comboId: 99, position: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the position is already taken', async () => {
      service.uploadImage.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una imagen en la posición 1 para este combo',
        ),
      );

      await expect(controller.uploadImage(mockFile, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const dto = { comboId: 1, url: 'https://img.com/combo1.jpg', position: 1 };

    it('delegates to service.create', async () => {
      const image = mockResponse();
      service.create.mockResolvedValue(image as any);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(image);
    });

    it('propagates NotFoundException when the combo does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new NotFoundException('Combo con id 99 no encontrado'),
      );

      await expect(controller.create({ ...dto, comboId: 99 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates ConflictException when the position is already taken', async () => {
      service.create.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una imagen en la posición 1 para este combo',
        ),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ==========================
  // findByCombo
  // ==========================

  describe('findByCombo', () => {
    it('delegates to service.findByCombo', async () => {
      service.findByCombo.mockResolvedValue([mockResponse() as any]);
      const result = await controller.findByCombo(1);
      expect(service.findByCombo).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });

    it('returns an empty array when the combo has no images', async () => {
      service.findByCombo.mockResolvedValue([]);
      const result = await controller.findByCombo(1);
      expect(result).toEqual([]);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('delegates to service.findOne', async () => {
      const image = mockResponse();
      service.findOne.mockResolvedValue(image as any);
      const result = await controller.findOne(1);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(image);
    });

    it('propagates NotFoundException when not found', async () => {
      service.findOne.mockRejectedValueOnce(
        new NotFoundException('Imagen de combo con id 999 no encontrada'),
      );
      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update', async () => {
      const image = mockResponse({ position: 2 });
      service.update.mockResolvedValue(image as any);
      const result = await controller.update(1, { position: 2 });
      expect(service.update).toHaveBeenCalledWith(1, { position: 2 });
      expect(result).toBe(image);
    });

    it('propagates NotFoundException when not found', async () => {
      service.update.mockRejectedValueOnce(
        new NotFoundException('Imagen de combo con id 999 no encontrada'),
      );
      await expect(controller.update(999, { position: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates ConflictException when the position is already taken', async () => {
      service.update.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una imagen en la posición 2 para este combo',
        ),
      );
      await expect(controller.update(1, { position: 2 })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove(1);
      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('propagates NotFoundException when not found', async () => {
      service.remove.mockRejectedValueOnce(
        new NotFoundException('Imagen de combo con id 999 no encontrada'),
      );
      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
