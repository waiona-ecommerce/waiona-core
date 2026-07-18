import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RoleType } from '../../../common/enums/role-type.enum';

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

  const mockJwt = (sub: number) => ({ sub, role: RoleType.CLIENT });

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
    it('delegates to service.findAll with query, page and limit', async () => {
      const query = { page: 2, limit: 10, email: 'juan' } as any;
      const paginated = mockPaginated([]);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        query,
        query.page,
        query.limit,
      );
      expect(result).toBe(paginated);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('delegates to service.findOne when accessing own user', async () => {
      const user = mockUserDto();
      service.findOne.mockResolvedValue(user as any);

      const result = await controller.findOne(1, mockJwt(1));

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(user);
    });

    it('throws ForbiddenException when accessing another user', () => {
      expect(() => controller.findOne(2, mockJwt(1))).toThrow(
        ForbiddenException,
      );
      expect(service.findOne).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Usuario no encontrado'),
      );

      await expect(controller.findOne(1, mockJwt(1))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // update
  // ==========================

  describe('update', () => {
    it('delegates to service.update when updating own user', async () => {
      const dto = { name: 'Carlos' };
      const updated = mockUserDto();
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(1, mockJwt(1), dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(updated);
    });

    it('throws ForbiddenException when updating another user', () => {
      expect(() => controller.update(2, mockJwt(1), {} as any)).toThrow(
        ForbiddenException,
      );
      expect(service.update).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException from service', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Usuario no encontrado'),
      );

      await expect(controller.update(1, mockJwt(1), {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================
  // remove
  // ==========================

  describe('remove', () => {
    it('delegates to service.remove when removing own user', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(1, mockJwt(1));

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });

    it('throws ForbiddenException when removing another user', () => {
      expect(() => controller.remove(2, mockJwt(1))).toThrow(
        ForbiddenException,
      );
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException from service', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Usuario no encontrado'),
      );

      await expect(controller.remove(1, mockJwt(1))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates ConflictException from service when user has active orders', async () => {
      service.remove.mockRejectedValue(
        new ConflictException('Tenés órdenes pendientes de completar'),
      );

      await expect(controller.remove(1, mockJwt(1))).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
