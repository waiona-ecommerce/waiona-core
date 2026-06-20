import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ComboImageService } from '../../../products/combo-images/services/combo-image.service';
import { ComboImageEntity } from '../../../products/combo-images/entities/combo-image.entity';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';
import { StorageService } from '../../../storage/storage.service';
describe('ComboImageService', () => {
  let service: ComboImageService;

  const mockImageRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  };
  const mockComboRepo = { findOne: jest.fn() };
  const mockStorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
  };
  const mockImage = (overrides = {}): ComboImageEntity =>
    ({
      id: 1,
      comboId: 1,
      url: 'https://img.com/combo1.jpg',
      publicId: null,
      position: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ComboImageEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComboImageService,
        {
          provide: getRepositoryToken(ComboImageEntity),
          useValue: mockImageRepo,
        },
        { provide: getRepositoryToken(ComboEntity), useValue: mockComboRepo },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();
    service = module.get<ComboImageService>(ComboImageService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create an image', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.create.mockReturnValue(mockImage());
      mockImageRepo.save.mockResolvedValue(mockImage());
      const result = await service.create({
        comboId: 1,
        url: 'https://img.com/combo1.jpg',
        position: 1,
      });
      expect(result.url).toBe('https://img.com/combo1.jpg');
    });

    it('should throw NotFoundException if combo not found', async () => {
      mockComboRepo.findOne.mockResolvedValue(null);
      await expect(service.create({ comboId: 99 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCombo', () => {
    it('should return images for a combo', async () => {
      mockImageRepo.find.mockResolvedValue([mockImage()]);
      const result = await service.findByCombo(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return an image', async () => {
      mockImageRepo.findOne.mockResolvedValue(mockImage());
      expect((await service.findOne(1)).id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      mockImageRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an image', async () => {
      const image = mockImage();
      const updated = mockImage({ position: 2 });
      mockImageRepo.findOne
        .mockResolvedValueOnce(image) // findEntity
        .mockResolvedValueOnce(null); // assertPositionFree (no conflict)
      mockImageRepo.merge.mockReturnValue(updated);
      mockImageRepo.save.mockResolvedValue(updated);
      expect((await service.update(1, { position: 2 } as any)).position).toBe(
        2,
      );
    });

    it('should throw NotFoundException', async () => {
      mockImageRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete an image without Cloudinary call when no publicId', async () => {
      const image = mockImage({ publicId: null });
      mockImageRepo.findOne.mockResolvedValue(image);
      mockImageRepo.softDelete.mockResolvedValue({} as any);
      await service.remove(1);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockImageRepo.softDelete).toHaveBeenCalledWith(image.id);
    });

    it('should delete from Cloudinary before soft delete when publicId exists', async () => {
      const image = mockImage({ publicId: 'waiona/combos/abc123' });
      mockImageRepo.findOne.mockResolvedValue(image);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockImageRepo.softDelete.mockResolvedValue({} as any);
      await service.remove(1);
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        'waiona/combos/abc123',
      );
      expect(mockImageRepo.softDelete).toHaveBeenCalledWith(image.id);
    });

    it('should throw NotFoundException', async () => {
      mockImageRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadImage', () => {
    const mockFile = {
      buffer: Buffer.from('img'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    } as Express.Multer.File;

    it('should upload to Cloudinary and save record', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockStorageService.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/x/combo.jpg',
        publicId: 'waiona/combos/abc',
      });
      const saved = mockImage({
        url: 'https://res.cloudinary.com/x/combo.jpg',
        publicId: 'waiona/combos/abc',
      });
      mockImageRepo.create.mockReturnValue(saved);
      mockImageRepo.save.mockResolvedValue(saved);

      const result = await service.uploadImage(mockFile, {
        comboId: 1,
        position: 1,
      });
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        mockFile,
        'waiona/combos',
      );
      expect(result.url).toBe('https://res.cloudinary.com/x/combo.jpg');
    });

    it('should throw NotFoundException if combo not found', async () => {
      mockComboRepo.findOne.mockResolvedValue(null);
      await expect(
        service.uploadImage(mockFile, { comboId: 99, position: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
