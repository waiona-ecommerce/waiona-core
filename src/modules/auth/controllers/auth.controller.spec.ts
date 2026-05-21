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
    generateToken: jest.fn(() => 'mock_token'),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  });

  const mockLocalGuard = { canActivate: jest.fn(() => true) };

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
    it('should return user and access_token', () => {
      const user = mockUser();
      const req = { user } as any;

      const result = controller.login(req);

      expect(service.generateToken).toHaveBeenCalledWith(user);
      expect(result.access_token).toBe('mock_token');
      expect(result.user).toBe(user);
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
});
