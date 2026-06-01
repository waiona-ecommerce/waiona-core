import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { UsersService } from './users.service';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';
import { RoleType } from '../../../common/enums/role-type.enum';

describe('UsersService', () => {
  let service: UsersService;

  const mockQB = {
    addSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const mockUserRepo = () => ({
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQB),
  });
  const mockRoleRepo = () => ({ findOne: jest.fn() });

  const mockEntityManager = { create: jest.fn(), save: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  const mockRole = {
    id: 3,
    type: RoleType.CLIENT,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockProfile = {
    id: 1,
    name: 'Juan',
    lastName: 'Pérez',
    avatar: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockUser = (overrides = {}): UserEntity =>
    ({
      id: 1,
      email: 'juan@test.com',
      password: 'hashed',
      isActive: false,
      deletedAt: null,
      profile: mockProfile,
      role: mockRole,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as UserEntity;

  let userRepo: any;
  let roleRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useFactory: mockUserRepo },
        { provide: getRepositoryToken(RoleEntity), useFactory: mockRoleRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(UserEntity));
    roleRepo = module.get(getRepositoryToken(RoleEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockQB.getOne.mockReset();
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const dto = {
      email: 'juan@test.com',
      password: '12345678',
      name: 'Juan',
      lastName: 'Pérez',
    };

    it('should create a user with CLIENT role in transaction', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(mockRole);
      mockEntityManager.create
        .mockReturnValueOnce(mockProfile)
        .mockReturnValueOnce(user);
      mockEntityManager.save.mockResolvedValue(user);

      const result = await service.create(dto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result.email).toBe('juan@test.com');
    });

    it('should throw ConflictException if email already exists', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user without role if CLIENT role not found', async () => {
      const user = mockUser({ role: undefined });
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(null);
      mockEntityManager.create
        .mockReturnValueOnce(mockProfile)
        .mockReturnValueOnce(user);
      mockEntityManager.save.mockResolvedValue(user);

      const result = await service.create(dto);
      expect(result).toBeDefined();
    });
  });

  // ==========================
  // findByEmail
  // ==========================

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      mockQB.getOne.mockResolvedValue(mockUser());
      const result = await service.findByEmail('juan@test.com');
      expect(result?.email).toBe('juan@test.com');
    });

    it('should return null if not found', async () => {
      mockQB.getOne.mockResolvedValue(null);
      const result = await service.findByEmail('noexiste@test.com');
      expect(result).toBeNull();
    });
  });

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return paginated users', async () => {
      userRepo.findAndCount.mockResolvedValue([[mockUser()], 1]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
    });

    it('should return empty page', async () => {
      userRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
    });

    it('should filter by email', async () => {
      userRepo.findAndCount.mockResolvedValue([[mockUser()], 1]);
      const result = await service.findAll({ email: 'juan' });
      expect(userRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: expect.anything() }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('should filter by name using QueryBuilder', async () => {
      mockQB.getManyAndCount.mockResolvedValue([[mockUser()], 1]);
      const result = await service.findAll({ name: 'Juan' });
      expect(mockQB.getManyAndCount).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a user by id', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update user profile', async () => {
      const user = mockUser();
      const updated = mockUser({ profile: { ...mockProfile, name: 'Carlos' } });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Carlos' });
      expect(result.profile.name).toBe('Carlos');
    });

    it('should throw NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should soft delete user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove(1);

      expect(userRepo.softDelete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // activate
  // ==========================

  describe('activate', () => {
    it('should activate a user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1 });
      await service.activate(1);
      expect(userRepo.update).toHaveBeenCalledWith(1, { isActive: true });
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.activate(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================
  // updatePassword
  // ==========================

  describe('updatePassword', () => {
    it('should hash and update password', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1 });
      await service.updatePassword(1, 'newPassword123');
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ password: expect.any(String) }),
      );
      const call = userRepo.update.mock.calls[0][1];
      expect(call.password).not.toBe('newPassword123');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.updatePassword(999, 'pass')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
