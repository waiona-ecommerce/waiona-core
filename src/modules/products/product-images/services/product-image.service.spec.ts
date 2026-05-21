import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductImageService } from '../../../products/product-images/services/product-image.service';
import { ProductImageEntity } from '../../../products/product-images/entities/product-image.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';

describe('ProductImageService', () => {
  let service: ProductImageService;

  const mockImageRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  };
  const mockProductRepo = { findOne: jest.fn() };

  const mockImage = (overrides = {}): ProductImageEntity =>
    ({
      id: 1,
      productId: 1,
      url: 'https://img.com/1.jpg',
      position: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ProductImageEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductImageService,
        {
          provide: getRepositoryToken(ProductImageEntity),
          useValue: mockImageRepo,
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: mockProductRepo,
        },
      ],
    }).compile();
    service = module.get<ProductImageService>(ProductImageService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create an image', async () => {
      mockProductRepo.findOne.mockResolvedValue({ id: 1 });
      mockImageRepo.create.mockReturnValue(mockImage());
      mockImageRepo.save.mockResolvedValue(mockImage());
      const result = await service.create({
        productId: 1,
        url: 'https://img.com/1.jpg',
        position: 1,
      });
      expect(result.url).toBe('https://img.com/1.jpg');
    });

    it('should throw NotFoundException if product not found', async () => {
      mockProductRepo.findOne.mockResolvedValue(null);
      await expect(service.create({ productId: 99 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByProduct', () => {
    it('should return images for a product', async () => {
      mockImageRepo.find.mockResolvedValue([mockImage()]);
      const result = await service.findByProduct(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return an image', async () => {
      mockImageRepo.findOne.mockResolvedValue(mockImage());
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
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
      const result = await service.update(1, { position: 2 });
      expect(result.position).toBe(2);
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
