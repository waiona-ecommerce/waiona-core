import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { RoleType } from 'src/common/enums/role-type.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  const mockService = () => ({
    register: jest.fn(),
    activateAccount: jest.fn(),
    login: jest.fn().mockResolvedValue({
      access_token: 'mock_access',
      refresh_token: 'mock_refresh',
    }),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    logoutAll: jest.fn(),
  });

  const mockLocalGuard = { canActivate: jest.fn(() => true) };
  const mockJwtGuard = { canActivate: jest.fn(() => true) };

  const mockUser = () => ({
    id: 1,
    email: 'juan@test.com',
    isActive: true,
    profile: { name: 'Juan', lastName: 'Pérez' },
    role: { type: RoleType.CLIENT },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useFactory: mockService }],
    })
      .overrideGuard(AuthGuard('local'))
      .useValue(mockLocalGuard)
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockJwtGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // register
  // ==========================

  describe('register', () => {
    it('should register a user and return message', async () => {
      service.register.mockResolvedValue(undefined);

      const dto = {
        email: 'juan@test.com',
        password: '12345678',
        name: 'Juan',
        lastName: 'Pérez',
      };
      const result = await controller.register(dto);

      expect(service.register).toHaveBeenCalledWith(dto);
      expect(result.message).toContain('check your email');
    });
  });

  // ==========================
  // activate
  // ==========================

  describe('activate', () => {
    it('should activate account and return message', async () => {
      service.activateAccount.mockResolvedValue(undefined);

      const result = await controller.activate('valid_token');

      expect(service.activateAccount).toHaveBeenCalledWith('valid_token');
      expect(result.message).toContain('activated successfully');
    });
  });

  // ==========================
  // login
  // ==========================

  describe('login', () => {
    it('should return user, access_token and refresh_token', async () => {
      const user = mockUser();
      const req = { user } as any;

      const result = await controller.login(req);

      expect(service.login).toHaveBeenCalledWith(user);
      expect(result.access_token).toBe('mock_access');
      expect(result.refresh_token).toBe('mock_refresh');
      expect(result.user).toBe(user);
    });
  });

  // ==========================
  // refresh
  // ==========================

  describe('refresh', () => {
    it('should return new tokens', async () => {
      service.refresh.mockResolvedValue({
        access_token: 'new_access',
        refresh_token: 'new_refresh',
      });

      const result = await controller.refresh({ refresh_token: 'old_refresh' });

      expect(service.refresh).toHaveBeenCalledWith('old_refresh');
      expect(result.access_token).toBe('new_access');
      expect(result.refresh_token).toBe('new_refresh');
    });
  });

  // ==========================
  // logout
  // ==========================

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      service.logout.mockResolvedValue(undefined);

      await controller.logout({ refresh_token: 'some_token' });

      expect(service.logout).toHaveBeenCalledWith('some_token');
    });
  });

  // ==========================
  // forgotPassword
  // ==========================

  describe('forgotPassword', () => {
    it('should call service and return generic message', async () => {
      service.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword({
        email: 'juan@test.com',
      });

      expect(service.forgotPassword).toHaveBeenCalledWith('juan@test.com');
      expect(result.message).toBeDefined();
    });
  });

  // ==========================
  // resetPassword
  // ==========================

  describe('resetPassword', () => {
    it('should reset password and return message', async () => {
      service.resetPassword.mockResolvedValue(undefined);

      const dto = { token: 'raw_token', password: 'newPassword123' };
      const result = await controller.resetPassword(dto);

      expect(service.resetPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toContain('reset successfully');
    });
  });

  // ==========================
  // changePassword
  // ==========================

  describe('changePassword', () => {
    it('should change password and return message', async () => {
      service.changePassword.mockResolvedValue(undefined);
      const req = { user: { sub: 1, role: RoleType.CLIENT } } as any;
      const dto = { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' };

      const result = await controller.changePassword(req, dto);

      expect(service.changePassword).toHaveBeenCalledWith(1, dto);
      expect(result.message).toContain('changed successfully');
    });
  });

  // ==========================
  // logoutAll
  // ==========================

  describe('logoutAll', () => {
    it('should call logoutAll with userId from JWT', async () => {
      service.logoutAll.mockResolvedValue(undefined);
      const req = { user: { sub: 1, role: RoleType.CLIENT } } as any;

      await controller.logoutAll(req);

      expect(service.logoutAll).toHaveBeenCalledWith(1);
    });
  });
});
