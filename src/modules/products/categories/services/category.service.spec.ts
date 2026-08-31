import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { CategoryService } from '../../../products/categories/services/category.service';
import { CategoryEntity } from '../../../products/categories/entities/category.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';
describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepository: jest.Mocked<Repository<CategoryEntity>>;
  let productRepository: jest.Mocked<Repository<ProductEntity>>;
  let comboRepository: jest.Mocked<Repository<ComboEntity>>;

  const mockCategoryRepo = () => ({
    findAndCount: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    softDelete: jest.fn(),
  });

  const mockCountRepo = () => ({ count: jest.fn() });

  const mockCategory = (overrides = {}): CategoryEntity => ({
    id: 1,
    name: 'Bebidas',
    description: 'Bebidas en general',
    isActive: true,
    deletedAt: null,
    parentId: null,
    children: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(CategoryEntity),
          useFactory: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockCountRepo,
        },
        { provide: getRepositoryToken(ComboEntity), useFactory: mockCountRepo },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categoryRepository = module.get(getRepositoryToken(CategoryEntity));
    productRepository = module.get(getRepositoryToken(ProductEntity));
    comboRepository = module.get(getRepositoryToken(ComboEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return paginated categories', async () => {
      categoryRepository.findAndCount.mockResolvedValue([[mockCategory()], 1]);

      const result = await service.findAll(1, 20);

      expect(categoryRepository.findAndCount).toHaveBeenCalledWith({
        order: { name: 'ASC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Bebidas');
      expect(result.total).toBe(1);
    });

    it('should return empty page', async () => {
      categoryRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('should return a category', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());

      const result = await service.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Bebidas');
    });

    it('should throw NotFoundException', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a category without parent', async () => {
      categoryRepository.findOne.mockResolvedValue(null); // validateUniqueName
      const entity = mockCategory();
      categoryRepository.create.mockReturnValue(entity);
      categoryRepository.save.mockResolvedValue(entity);

      const result = await service.create({
        name: 'Bebidas',
      });

      expect(categoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null }),
      );
      expect(result.name).toBe('Bebidas');
    });

    it('should create a category with a valid parent', async () => {
      const parent = mockCategory({ id: 5, name: 'Bebidas' });
      categoryRepository.findOne
        .mockResolvedValueOnce(null) // validateUniqueName
        .mockResolvedValueOnce(parent); // parent lookup
      const entity = mockCategory({ id: 2, name: 'Gaseosas', parentId: 5 });
      categoryRepository.create.mockReturnValue(entity);
      categoryRepository.save.mockResolvedValue(entity);

      const result = await service.create({
        name: 'Gaseosas',
        parentId: 5,
      });

      expect(categoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 5 }),
      );
      expect(result.parentId).toBe(5);
    });

    it('should throw BadRequestException if parentId not found', async () => {
      categoryRepository.findOne
        .mockResolvedValueOnce(null) // validateUniqueName
        .mockResolvedValueOnce(null); // parent lookup

      await expect(
        service.create({ name: 'Sub', parentId: 99 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(categoryRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if name already exists', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());

      await expect(service.create({ name: 'Bebidas' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow creating a category with the same name as a soft-deleted one', async () => {
      // TypeORM agrega deletedAt IS NULL automáticamente — el soft-deleted no aparece
      categoryRepository.findOne.mockResolvedValue(null);
      const entity = mockCategory();
      categoryRepository.create.mockReturnValue(entity);
      categoryRepository.save.mockResolvedValue(entity);

      const result = await service.create({ name: 'Bebidas' });

      expect(result.name).toBe('Bebidas');
    });

    it('should throw ConflictException on unique constraint race condition', async () => {
      categoryRepository.findOne.mockResolvedValue(null); // validateUniqueName
      categoryRepository.create.mockReturnValue(mockCategory());
      categoryRepository.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], new Error('duplicate key')),
      );

      await expect(service.create({ name: 'Bebidas' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow unexpected errors from save', async () => {
      categoryRepository.findOne.mockResolvedValue(null);
      categoryRepository.create.mockReturnValue(mockCategory());
      categoryRepository.save.mockRejectedValue(new Error('db down'));

      await expect(service.create({ name: 'Bebidas' })).rejects.toThrow(
        'db down',
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update a category', async () => {
      const entity = mockCategory();
      const updated = mockCategory({ name: 'Gaseosas' });

      categoryRepository.findOne
        .mockResolvedValueOnce(entity) // this.findOne(id)
        .mockResolvedValueOnce(null); // validateUniqueName
      categoryRepository.merge.mockReturnValue(updated);
      categoryRepository.save.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Gaseosas' });

      expect(result.name).toBe('Gaseosas');
    });

    it('should not re-check uniqueness when the name is unchanged', async () => {
      const entity = mockCategory({ name: 'Bebidas' });
      categoryRepository.findOne.mockResolvedValueOnce(entity); // this.findOne(id) only
      categoryRepository.merge.mockReturnValue(entity);
      categoryRepository.save.mockResolvedValue(entity);

      await service.update(1, { name: 'Bebidas', description: 'Nueva desc' });

      expect(categoryRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should not check uniqueness when name is not provided', async () => {
      const entity = mockCategory();
      const updated = mockCategory({ description: 'Nueva desc' });
      categoryRepository.findOne.mockResolvedValueOnce(entity); // this.findOne(id) only
      categoryRepository.merge.mockReturnValue(updated);
      categoryRepository.save.mockResolvedValue(updated);

      const result = await service.update(1, { description: 'Nueva desc' });

      expect(categoryRepository.findOne).toHaveBeenCalledTimes(1);
      expect(result.description).toBe('Nueva desc');
    });

    it('should throw ConflictException if new name already taken', async () => {
      const entity = mockCategory({ name: 'Viejo' });
      const existing = mockCategory({ id: 2, name: 'Nuevo' });

      categoryRepository.findOne
        .mockResolvedValueOnce(entity)
        .mockResolvedValueOnce(existing);

      await expect(service.update(1, { name: 'Nuevo' } as any)).rejects.toThrow(
        ConflictException,
      );
      expect(categoryRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on unique constraint race condition', async () => {
      const entity = mockCategory({ name: 'Viejo' });
      categoryRepository.findOne
        .mockResolvedValueOnce(entity)
        .mockResolvedValueOnce(null);
      categoryRepository.merge.mockReturnValue(mockCategory({ name: 'Nuevo' }));
      categoryRepository.save.mockRejectedValue(
        new QueryFailedError('UPDATE', [], new Error('duplicate key')),
      );

      await expect(service.update(1, { name: 'Nuevo' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow unexpected errors from save', async () => {
      const entity = mockCategory({ name: 'Viejo' });
      categoryRepository.findOne
        .mockResolvedValueOnce(entity)
        .mockResolvedValueOnce(null);
      categoryRepository.merge.mockReturnValue(mockCategory({ name: 'Nuevo' }));
      categoryRepository.save.mockRejectedValue(new Error('db down'));

      await expect(service.update(1, { name: 'Nuevo' })).rejects.toThrow(
        'db down',
      );
    });
  });

  // ==========================
  // delete
  // ==========================

  describe('delete', () => {
    it('should soft delete a category with no children, products or combos', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      categoryRepository.count.mockResolvedValue(0);
      productRepository.count.mockResolvedValue(0);
      comboRepository.count.mockResolvedValue(0);
      categoryRepository.softDelete.mockResolvedValue({} as any);

      await service.delete(1);

      expect(categoryRepository.softDelete).toHaveBeenCalledWith(1);
    });

    it('should throw ConflictException if category has active children', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      categoryRepository.count.mockResolvedValue(2);
      productRepository.count.mockResolvedValue(0);
      comboRepository.count.mockResolvedValue(0);

      await expect(service.delete(1)).rejects.toThrow(ConflictException);
      expect(categoryRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if category has active products', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      categoryRepository.count.mockResolvedValue(0);
      productRepository.count.mockResolvedValue(3);
      comboRepository.count.mockResolvedValue(0);

      await expect(service.delete(1)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if category has active combos', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      categoryRepository.count.mockResolvedValue(0);
      productRepository.count.mockResolvedValue(0);
      comboRepository.count.mockResolvedValue(2);

      await expect(service.delete(1)).rejects.toThrow(ConflictException);
    });

    it('should list every blocking reason in the error message', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory());
      categoryRepository.count.mockResolvedValue(1);
      productRepository.count.mockResolvedValue(2);
      comboRepository.count.mockResolvedValue(3);

      await expect(service.delete(1)).rejects.toThrow(
        'tiene 1 subcategoría(s), 2 producto(s), 3 combo(s) asignado(s)',
      );
    });

    it('should throw NotFoundException if category not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // getTree
  // ==========================

  describe('getTree', () => {
    it('should return tree with nested children', async () => {
      const root = mockCategory({ id: 1, parentId: null });
      const child = mockCategory({ id: 2, name: 'Gaseosas', parentId: 1 });

      categoryRepository.find.mockResolvedValue([root, child]);

      const result = await service.getTree();

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Gaseosas');
    });

    it('should build a nested tree across multiple levels', async () => {
      const root = mockCategory({ id: 1, name: 'Bebidas', parentId: null });
      const child = mockCategory({ id: 2, name: 'Gaseosas', parentId: 1 });
      const grandchild = mockCategory({ id: 3, name: 'Cola', parentId: 2 });

      // orden intencionalmente desordenado: no depende del orden de llegada
      categoryRepository.find.mockResolvedValue([grandchild, root, child]);

      const result = await service.getTree();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bebidas');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Gaseosas');
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].name).toBe('Cola');
    });

    it('should treat a category whose parent no longer exists as a root', async () => {
      const orphan = mockCategory({ id: 2, name: 'Huérfana', parentId: 999 });

      categoryRepository.find.mockResolvedValue([orphan]);

      const result = await service.getTree();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Huérfana');
    });

    it('should return empty array if no categories', async () => {
      categoryRepository.find.mockResolvedValue([]);

      const result = await service.getTree();

      expect(result).toEqual([]);
    });
  });
});
