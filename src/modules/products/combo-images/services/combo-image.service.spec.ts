import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ComboImageService } from '../../../products/combo-images/services/combo-image.service';
import { ComboImageEntity } from '../../../products/combo-images/entities/combo-image.entity';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';

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

  const mockImage = (overrides = {}): ComboImageEntity =>
    ({
      id: 1,
      comboId: 1,
      url: 'https://img.com/combo1.jpg',
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
      mockImageRepo.findOne.mockResolvedValue(image);
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
    it('should soft delete an image', async () => {
      const image = mockImage();
      mockImageRepo.findOne.mockResolvedValue(image);
      mockImageRepo.softDelete.mockResolvedValue({} as any);
      await service.remove(1);
      expect(mockImageRepo.softDelete).toHaveBeenCalledWith(image.id);
    });

    it('should throw NotFoundException', async () => {
      mockImageRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
