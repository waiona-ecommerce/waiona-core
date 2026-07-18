import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { UsersService } from './users.service';
import { UserEntity } from '../entities/user.entity';
import { ProfileEntity } from '../entities/profile.entity';
import { RoleEntity } from '../entities/role.entity';
import { RoleType } from '../../../common/enums/role-type.enum';
import { OrderEntity } from '../../orders/entities/order.entity';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { UserResponseDto } from '../dto/user-response.dto';

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
  const mockOrderRepo = () => ({ count: jest.fn() });

  const mockEntityManager = {
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };
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
      profileId: 1,
      profile: mockProfile,
      role: mockRole,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as UserEntity;

  let userRepo: any;
  let roleRepo: any;
  let orderRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useFactory: mockUserRepo },
        { provide: getRepositoryToken(RoleEntity), useFactory: mockRoleRepo },
        {
          provide: getRepositoryToken(OrderEntity),
          useFactory: mockOrderRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(UserEntity));
    roleRepo = module.get(getRepositoryToken(RoleEntity));
    orderRepo = module.get(getRepositoryToken(OrderEntity));
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

    it('creates the profile and user, assigning the CLIENT role, inside a transaction', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(mockRole);
      mockEntityManager.create
        .mockReturnValueOnce(mockProfile)
        .mockReturnValueOnce(user);
      mockEntityManager.save.mockResolvedValue(user);

      const result = await service.create(dto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledWith(ProfileEntity, {
        name: dto.name,
        lastName: dto.lastName,
        avatar: null,
      });
      expect(mockEntityManager.create).toHaveBeenCalledWith(UserEntity, {
        email: dto.email,
        password: dto.password,
        profile: mockProfile,
        role: mockRole,
      });
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.email).toBe('juan@test.com');
    });

    it('throws ConflictException without starting a transaction when email already exists', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates the user without a role when CLIENT role is not seeded', async () => {
      const user = mockUser({ role: undefined });
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(null);
      mockEntityManager.create
        .mockReturnValueOnce(mockProfile)
        .mockReturnValueOnce(user);
      mockEntityManager.save.mockResolvedValue(user);

      await service.create(dto);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        UserEntity,
        expect.objectContaining({ role: undefined }),
      );
    });

    it('converts a DB unique violation (race condition) into ConflictException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(mockRole);
      mockEntityManager.create
        .mockReturnValueOnce(mockProfile)
        .mockReturnValueOnce(mockUser());
      mockEntityManager.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('rethrows unexpected DB errors as-is', async () => {
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(mockRole);
      mockEntityManager.create
        .mockReturnValueOnce(mockProfile)
        .mockReturnValueOnce(mockUser());
      mockEntityManager.save.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(dto)).rejects.toThrow('connection lost');
    });
  });

  // ==========================
  // findByEmail
  // ==========================

  describe('findByEmail', () => {
    it('builds the query including password and excluding soft-deleted users', async () => {
      const user = mockUser();
      mockQB.getOne.mockResolvedValue(user);

      const result = await service.findByEmail('juan@test.com');

      expect(userRepo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQB.addSelect).toHaveBeenCalledWith('user.password');
      expect(mockQB.where).toHaveBeenCalledWith('user.email = :email', {
        email: 'juan@test.com',
      });
      expect(mockQB.andWhere).toHaveBeenCalledWith('user.deletedAt IS NULL');
      expect(result).toBe(user);
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

    it('should filter by name using QueryBuilder and exclude soft-deleted users', async () => {
      mockQB.getManyAndCount.mockResolvedValue([[mockUser()], 1]);
      const result = await service.findAll({ name: 'Juan' });

      expect(mockQB.where).toHaveBeenCalledWith(
        expect.stringContaining('profile.name ILIKE'),
        { name: '%Juan%' },
      );
      expect(mockQB.andWhere).toHaveBeenCalledWith('user.deletedAt IS NULL');
      expect(result.data).toHaveLength(1);
    });

    it('should also filter by email when name and email are both provided', async () => {
      mockQB.getManyAndCount.mockResolvedValue([[mockUser()], 1]);
      await service.findAll({ name: 'Juan', email: 'juan' });

      expect(mockQB.andWhere).toHaveBeenCalledWith('user.email ILIKE :email', {
        email: '%juan%',
      });
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('maps the entity to UserResponseDto', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne(1);

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.role).toBe(RoleType.CLIENT);
      expect(result.profile.name).toBe(user.profile.name);
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
    it('updates only the provided fields and preserves the rest', async () => {
      const user = mockUser({ profile: { ...mockProfile } });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.update(1, { name: 'Carlos' });

      expect(user.profile.name).toBe('Carlos');
      expect(user.profile.lastName).toBe(mockProfile.lastName);
      expect(user.profile.avatar).toBe(mockProfile.avatar);
      expect(userRepo.save).toHaveBeenCalledWith(user);
      expect(result.profile.name).toBe('Carlos');
    });

    it('updates multiple fields at once', async () => {
      const user = mockUser({ profile: { ...mockProfile } });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);

      await service.update(1, {
        name: 'Carlos',
        lastName: 'Gómez',
        avatar: 'https://example.com/avatar.png',
      });

      expect(user.profile).toMatchObject({
        name: 'Carlos',
        lastName: 'Gómez',
        avatar: 'https://example.com/avatar.png',
      });
    });

    it('leaves the profile untouched when no fields are provided', async () => {
      const user = mockUser({ profile: { ...mockProfile } });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);

      await service.update(1, {});

      expect(user.profile).toEqual(mockProfile);
    });

    it('should throw NotFoundException without saving when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should soft delete user and profile in transaction', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      orderRepo.count.mockResolvedValue(0);
      mockEntityManager.softDelete.mockResolvedValue(undefined);

      await service.remove(1);

      expect(orderRepo.count).toHaveBeenCalledWith({
        where: {
          userId: 1,
          status: In([
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.DISPATCHED,
          ]),
        },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.softDelete).toHaveBeenCalledWith(UserEntity, 1);
      expect(mockEntityManager.softDelete).toHaveBeenCalledWith(
        ProfileEntity,
        1,
      );
    });

    it('should throw NotFoundException without checking orders', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(orderRepo.count).not.toHaveBeenCalled();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user has active orders', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      orderRepo.count.mockResolvedValue(1);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
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
      expect(userRepo.update).not.toHaveBeenCalled();
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

      const [id, payload] = userRepo.update.mock.calls[0];
      expect(id).toBe(1);
      expect(payload.password).not.toBe('newPassword123');
      await expect(
        bcrypt.compare('newPassword123', payload.password),
      ).resolves.toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.updatePassword(999, 'pass')).rejects.toThrow(
        NotFoundException,
      );
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });
});
