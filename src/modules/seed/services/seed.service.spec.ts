import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SeedService } from './seed.service';
import { UserEntity } from '../../users/entities/user.entity';
import { RoleEntity } from '../../users/entities/role.entity';
import { RoleType } from '../../../common/enums/role-type.enum';

describe('SeedService', () => {
  let service: SeedService;
  let userRepo: any;
  let roleRepo: any;

  const mockUserRepo = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  });

  const mockRoleRepo = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  });

  const mockRole = (type: RoleType): RoleEntity =>
    ({
      id: 1,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as RoleEntity;

  const mockUser = (): UserEntity =>
    ({
      id: 1,
      email: 'super@test.com',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as UserEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: getRepositoryToken(UserEntity), useFactory: mockUserRepo },
        { provide: getRepositoryToken(RoleEntity), useFactory: mockRoleRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'SUPERADMIN_EMAIL') return 'super@test.com';
              if (key === 'SUPERADMIN_PASSWORD') return 'secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
    userRepo = module.get(getRepositoryToken(UserEntity));
    roleRepo = module.get(getRepositoryToken(RoleEntity));
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onApplicationBootstrap', () => {
    it('should call seedRoles and seedSuperAdmin on bootstrap', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole(RoleType.SUPER_ADMIN));
      userRepo.findOne.mockResolvedValue(mockUser());

      await service.onApplicationBootstrap();

      expect(roleRepo.findOne).toHaveBeenCalled();
      expect(userRepo.findOne).toHaveBeenCalled();
    });
  });

  describe('seedRoles', () => {
    it('should create roles that do not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      roleRepo.create.mockImplementation((data: any) => data);
      roleRepo.save.mockResolvedValue({});
      userRepo.findOne.mockResolvedValue(mockUser());

      await service.onApplicationBootstrap();

      expect(roleRepo.create).toHaveBeenCalledTimes(
        Object.values(RoleType).length,
      );
      expect(roleRepo.save).toHaveBeenCalledTimes(
        Object.values(RoleType).length,
      );
    });

    it('should skip roles that already exist', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole(RoleType.SUPER_ADMIN));
      userRepo.findOne.mockResolvedValue(mockUser());

      await service.onApplicationBootstrap();

      expect(roleRepo.create).not.toHaveBeenCalled();
      expect(roleRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('seedSuperAdmin', () => {
    it('should create superadmin when none exists', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole(RoleType.SUPER_ADMIN));
      userRepo.findOne.mockResolvedValueOnce(null);
      userRepo.create.mockReturnValue(mockUser());
      userRepo.save.mockResolvedValue(mockUser());

      await service.onApplicationBootstrap();

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'super@test.com', isActive: true }),
      );
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should skip creation when superadmin already exists', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole(RoleType.SUPER_ADMIN));
      userRepo.findOne.mockResolvedValue(mockUser());

      await service.onApplicationBootstrap();

      expect(userRepo.create).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should create superadmin with isActive = true', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole(RoleType.SUPER_ADMIN));
      userRepo.findOne.mockResolvedValueOnce(null);
      userRepo.create.mockImplementation((data: any) => data);
      userRepo.save.mockResolvedValue({});

      await service.onApplicationBootstrap();

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });
  });
});
