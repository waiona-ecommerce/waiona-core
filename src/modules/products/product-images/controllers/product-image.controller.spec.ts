import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ProductImageController } from '../../../products/product-images/controllers/product-image.controller';
import { ProductImageService } from '../../../products/product-images/services/product-image.service';
import { RolesGuard } from '../../../../common/guards/roles.guard';

describe('ProductImageController', () => {
  let controller: ProductImageController;
  let service: jest.Mocked<ProductImageService>;

  const mockService = () => ({
    create: jest.fn(),
    findByProduct: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    uploadImage: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };
  const mockResponse = (overrides = {}) => ({
    id: 1,
    productId: 1,
    url: 'https://img.com/1.jpg',
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
      controllers: [ProductImageController],
      providers: [
        { provide: ProductImageService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ProductImageController>(ProductImageController);
    service = module.get(ProductImageService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // uploadImage
  // ==========================

  describe('uploadImage', () => {
    const dto = { productId: 1, position: 1 };

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

    it('propagates NotFoundException when the product does not exist', async () => {
      service.uploadImage.mockRejectedValueOnce(
        new NotFoundException('Producto con id 99 no encontrado'),
      );

      await expect(
        controller.uploadImage(mockFile, { productId: 99, position: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the position is already taken', async () => {
      service.uploadImage.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una imagen en la posición 1 para este producto',
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
    const dto = { productId: 1, url: 'https://img.com/1.jpg', position: 1 };

    it('delegates to service.create', async () => {
      const image = mockResponse();
      service.create.mockResolvedValue(image as any);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(image);
    });

    it('propagates NotFoundException when the product does not exist', async () => {
      service.create.mockRejectedValueOnce(
        new NotFoundException('Producto con id 99 no encontrado'),
      );

      await expect(
        controller.create({ ...dto, productId: 99 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when the position is already taken', async () => {
      service.create.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una imagen en la posición 1 para este producto',
        ),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ==========================
  // findByProduct
  // ==========================

  describe('findByProduct', () => {
    it('delegates to service.findByProduct', async () => {
      service.findByProduct.mockResolvedValue([mockResponse() as any]);
      const result = await controller.findByProduct(1);
      expect(service.findByProduct).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });

    it('returns an empty array when the product has no images', async () => {
      service.findByProduct.mockResolvedValue([]);
      const result = await controller.findByProduct(1);
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
        new NotFoundException('Imagen de producto con id 999 no encontrada'),
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
        new NotFoundException('Imagen de producto con id 999 no encontrada'),
      );
      await expect(controller.update(999, { position: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates ConflictException when the position is already taken', async () => {
      service.update.mockRejectedValueOnce(
        new ConflictException(
          'Ya existe una imagen en la posición 2 para este producto',
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
        new NotFoundException('Imagen de producto con id 999 no encontrada'),
      );
      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
