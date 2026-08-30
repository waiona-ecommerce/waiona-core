import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
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

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const dto = { comboId: 1, url: 'https://img.com/combo1.jpg', position: 1 };

    it('should create an image', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne.mockResolvedValue(null); // assertPositionFree
      mockImageRepo.create.mockReturnValue(mockImage());
      mockImageRepo.save.mockResolvedValue(mockImage());

      const result = await service.create(dto);

      expect(result.url).toBe('https://img.com/combo1.jpg');
    });

    it('should throw NotFoundException if combo not found', async () => {
      mockComboRepo.findOne.mockResolvedValue(null);
      await expect(service.create({ ...dto, comboId: 99 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if position is already taken', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne.mockResolvedValue(mockImage());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockImageRepo.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on unique constraint race condition', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne.mockResolvedValue(null);
      mockImageRepo.create.mockReturnValue(mockImage());
      mockImageRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], new Error('duplicate key')),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected errors from save', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne.mockResolvedValue(null);
      mockImageRepo.create.mockReturnValue(mockImage());
      mockImageRepo.save.mockRejectedValue(new Error('db down'));

      await expect(service.create(dto)).rejects.toThrow('db down');
    });
  });

  // ==========================
  // findByCombo
  // ==========================

  describe('findByCombo', () => {
    it('should return images for a combo ordered by position', async () => {
      mockImageRepo.find.mockResolvedValue([mockImage()]);

      const result = await service.findByCombo(1);

      expect(mockImageRepo.find).toHaveBeenCalledWith({
        where: { comboId: 1 },
        order: { position: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });

    it('should return an empty array when the combo has no images', async () => {
      mockImageRepo.find.mockResolvedValue([]);
      const result = await service.findByCombo(1);
      expect(result).toEqual([]);
    });
  });

  // ==========================
  // findOne
  // ==========================

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

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update an image and check position availability when it changes', async () => {
      const image = mockImage();
      const updated = mockImage({ position: 2 });
      mockImageRepo.findOne
        .mockResolvedValueOnce(image) // findEntity
        .mockResolvedValueOnce(null); // assertPositionFree (no conflict)
      mockImageRepo.merge.mockReturnValue(updated);
      mockImageRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, { position: 2 });

      expect(mockImageRepo.findOne).toHaveBeenCalledTimes(2);
      expect(result.position).toBe(2);
    });

    it('should not re-check position availability when position is unchanged', async () => {
      const image = mockImage(); // position 1
      mockImageRepo.findOne.mockResolvedValueOnce(image); // findEntity only
      mockImageRepo.merge.mockReturnValue(image);
      mockImageRepo.save.mockResolvedValue(image);

      await service.update(1, { position: 1 });

      expect(mockImageRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if the new position is already taken', async () => {
      const image = mockImage();
      mockImageRepo.findOne
        .mockResolvedValueOnce(image) // findEntity
        .mockResolvedValueOnce(mockImage({ id: 2, position: 2 })); // assertPositionFree conflict

      await expect(service.update(1, { position: 2 })).rejects.toThrow(
        ConflictException,
      );
      expect(mockImageRepo.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on unique constraint race condition', async () => {
      const image = mockImage();
      mockImageRepo.findOne
        .mockResolvedValueOnce(image)
        .mockResolvedValueOnce(null);
      mockImageRepo.merge.mockReturnValue(mockImage({ position: 2 }));
      mockImageRepo.save.mockRejectedValue(
        new QueryFailedError('UPDATE', [], new Error('duplicate key')),
      );

      await expect(service.update(1, { position: 2 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException', async () => {
      mockImageRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // uploadImage
  // ==========================

  describe('uploadImage', () => {
    const mockFile = {
      buffer: Buffer.from('img'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    } as Express.Multer.File;

    it('should upload to Cloudinary and save record', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne.mockResolvedValue(null); // assertPositionFree (x2)
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
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if position is already taken', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne.mockResolvedValue(mockImage());

      await expect(
        service.uploadImage(mockFile, { comboId: 1, position: 1 }),
      ).rejects.toThrow(ConflictException);
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('should delete the uploaded file and throw NotFoundException if the combo was deleted during upload', async () => {
      mockComboRepo.findOne
        .mockResolvedValueOnce({ id: 1 }) // initial check
        .mockResolvedValueOnce(null); // stillExists check
      mockImageRepo.findOne.mockResolvedValue(null); // assertPositionFree
      mockStorageService.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/x/combo.jpg',
        publicId: 'waiona/combos/abc',
      });
      mockStorageService.delete.mockResolvedValue(undefined);

      await expect(
        service.uploadImage(mockFile, { comboId: 1, position: 1 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        'waiona/combos/abc',
      );
      expect(mockImageRepo.save).not.toHaveBeenCalled();
    });

    it('should delete the uploaded file and throw ConflictException if the position was taken during upload', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne
        .mockResolvedValueOnce(null) // assertPositionFree before upload
        .mockResolvedValueOnce(mockImage()); // assertPositionFree inside try (race)
      mockStorageService.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/x/combo.jpg',
        publicId: 'waiona/combos/abc',
      });
      mockStorageService.delete.mockResolvedValue(undefined);

      await expect(
        service.uploadImage(mockFile, { comboId: 1, position: 1 }),
      ).rejects.toThrow(ConflictException);

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        'waiona/combos/abc',
      );
    });

    it('should delete the uploaded file and throw ConflictException on unique constraint race condition', async () => {
      mockComboRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.findOne.mockResolvedValue(null);
      mockStorageService.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/x/combo.jpg',
        publicId: 'waiona/combos/abc',
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockImageRepo.create.mockReturnValue(mockImage());
      mockImageRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], new Error('duplicate key')),
      );

      await expect(
        service.uploadImage(mockFile, { comboId: 1, position: 1 }),
      ).rejects.toThrow(ConflictException);

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        'waiona/combos/abc',
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should soft delete an image without Cloudinary call when no publicId', async () => {
      const image = mockImage({ publicId: null });
      mockImageRepo.findOne.mockResolvedValue(image);
      mockImageRepo.softDelete.mockResolvedValue({} as any);
      await service.remove(1);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockImageRepo.softDelete).toHaveBeenCalledWith(image.id);
    });

    it('should soft delete then delete from Cloudinary when publicId exists', async () => {
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
});
