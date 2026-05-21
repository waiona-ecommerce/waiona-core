import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';
import { RolesGuard } from 'src/common/guards/roles.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    activate: jest.fn(),
    updatePassword: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  const mockUserDto = (overrides = {}) => ({
    id: 1,
    email: 'juan@test.com',
    isActive: true,
    role: 'client',
    profile: { id: 1, name: 'Juan', lastName: 'Pérez', avatar: null },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockPaginated = (items: any[] = [mockUserDto()]) => ({
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
  });

  const mockRequest = (sub: number) => ({ user: { sub } }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useFactory: mockService },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // findAll
  // ==========================

  describe('findAll', () => {
    it('should return paginated users', async () => {
      service.findAll.mockResolvedValue(mockPaginated());
      const result = await controller.findAll({});
      expect(service.findAll).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should pass query params to service', async () => {
      service.findAll.mockResolvedValue(mockPaginated([]));
      const query = { email: 'juan' } as any;
      await controller.findAll(query);
      expect(service.findAll).toHaveBeenCalledWith(
        query,
        query.page,
        query.limit,
      );
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return own user', async () => {
      service.findOne.mockResolvedValue(mockUserDto() as any);
      const result = await controller.findOne(1, mockRequest(1));
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });

    it('should throw ForbiddenException if accessing another user', () => {
      expect(() => controller.findOne(2, mockRequest(1))).toThrow(
        ForbiddenException,
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('should update own user', async () => {
      const dto = { name: 'Carlos' };
      const updated = mockUserDto({
        profile: { id: 1, name: 'Carlos', lastName: 'Pérez', avatar: null },
      });
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(1, mockRequest(1), dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result.profile.name).toBe('Carlos');
    });

    it('should throw ForbiddenException if updating another user', () => {
      expect(() => controller.update(2, mockRequest(1), {} as any)).toThrow(
        ForbiddenException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('should remove own user', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove(1, mockRequest(1));
      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('should throw ForbiddenException if removing another user', () => {
      expect(() => controller.remove(2, mockRequest(1))).toThrow(
        ForbiddenException,
      );
    });
  });
});
