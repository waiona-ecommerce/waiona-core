import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));
import * as bcrypt from 'bcrypt';

jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomBytes: jest.fn(() => Buffer.from('deadbeef'.repeat(8), 'hex')),
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'hashed_token'),
    })),
  };
});

import { AuthService } from './auth.service';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../mail/services/mail.service';
import { TokenEntity } from '../../mail/entities/token.entity';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { TokenType } from '../../mail/enum/token-type.enum';
import { RoleType } from '../../../common/enums/role-type.enum';
import { UserEntity } from '../../users/entities/user.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;
  let mailService: any;
  let tokenRepo: any;
  let refreshTokenRepo: any;

  const mockUsersService = () => ({
    findByEmail: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    activate: jest.fn(),
    updatePassword: jest.fn(),
    findEntityWithPassword: jest.fn(),
  });

  const mockJwtService = () => ({
    sign: jest.fn(() => 'mock.jwt.token'),
  });

  const mockMailService = () => ({
    sendActivationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  });

  const mockTokenRepo = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  });

  const mockRefreshTokenRepo = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  });

  const mockUser = (overrides = {}): UserEntity =>
    ({
      id: 1,
      email: 'juan@test.com',
      password: 'hashed_pw',
      isActive: true,
      profile: { name: 'Juan', lastName: 'Pérez' },
      role: { type: RoleType.CLIENT },
      ...overrides,
    }) as unknown as UserEntity;

  const mockToken = (overrides = {}): TokenEntity =>
    ({
      id: 1,
      token: 'raw_token',
      type: TokenType.ACCOUNT_ACTIVATION,
      userId: 1,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      usedAt: null,
      isUsed: false,
      isExpired: false,
      ...overrides,
    }) as unknown as TokenEntity;

  const mockRefreshToken = (overrides = {}): RefreshTokenEntity =>
    ({
      id: 1,
      userId: 1,
      tokenHash: 'hashed_token',
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      revokedAt: null,
      isRevoked: false,
      isExpired: false,
      ...overrides,
    }) as unknown as RefreshTokenEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useFactory: mockUsersService },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: MailService, useFactory: mockMailService },
        { provide: getRepositoryToken(TokenEntity), useFactory: mockTokenRepo },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useFactory: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    tokenRepo = module.get(getRepositoryToken(TokenEntity));
    refreshTokenRepo = module.get(getRepositoryToken(RefreshTokenEntity));
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ==========================
  // validateUser
  // ==========================

  describe('validateUser', () => {
    it('should throw 401 if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(service.validateUser('x@x.com', 'pw')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw 401 if password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.validateUser('juan@test.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 401 if account not active', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser({ isActive: false }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.validateUser('juan@test.com', 'pw')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user on valid credentials', async () => {
      const user = mockUser();
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.validateUser('juan@test.com', 'pw');
      expect(result).toBe(user);
    });
  });

  // ==========================
  // generateToken
  // ==========================

  describe('generateToken', () => {
    it('should sign JWT with sub and role from user', () => {
      const token = service.generateToken(mockUser());
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        role: RoleType.CLIENT,
      });
      expect(token).toBe('mock.jwt.token');
    });
  });

  // ==========================
  // login
  // ==========================

  describe('login', () => {
    it('should return access_token and refresh_token', async () => {
      const user = mockUser();
      const rt = mockRefreshToken();
      refreshTokenRepo.create.mockReturnValue(rt);
      refreshTokenRepo.save.mockResolvedValue(rt);

      const result = await service.login(user);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.refresh_token).toBeDefined();
      expect(typeof result.refresh_token).toBe('string');
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });
  });

  // ==========================
  // refresh
  // ==========================

  describe('refresh', () => {
    it('should rotate refresh token and return new tokens', async () => {
      const rt = mockRefreshToken();
      refreshTokenRepo.findOne.mockResolvedValue(rt);
      refreshTokenRepo.save.mockResolvedValue(rt);
      usersService.findOne.mockResolvedValue(mockUser());
      refreshTokenRepo.create.mockReturnValue(rt);

      const result = await service.refresh('raw_token');

      expect(rt.revokedAt).not.toBeNull();
      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.refresh_token).toBeDefined();
    });

    it('should not revoke old token if issueRefreshToken fails', async () => {
      // Verifica que el bug de rotation order está corregido:
      // si falla la emisión del nuevo token, el viejo NO queda revocado
      // y el cliente puede reintentar.
      const rt = mockRefreshToken();
      refreshTokenRepo.findOne.mockResolvedValue(rt);
      usersService.findOne.mockResolvedValue(mockUser());
      refreshTokenRepo.create.mockReturnValue(mockRefreshToken());
      // primera llamada a save = nuevo token → falla
      refreshTokenRepo.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.refresh('raw_token')).rejects.toThrow('DB error');
      expect(rt.revokedAt).toBeNull(); // token viejo NO fue revocado
    });

    it('should throw 401 if refresh token not found', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('bad_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw 401 if refresh token is revoked', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(
        mockRefreshToken({ isRevoked: true }),
      );
      await expect(service.refresh('raw_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw 401 if refresh token is expired', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(
        mockRefreshToken({ isExpired: true }),
      );
      await expect(service.refresh('raw_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ==========================
  // logout
  // ==========================

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      const rt = mockRefreshToken();
      refreshTokenRepo.findOne.mockResolvedValue(rt);
      refreshTokenRepo.save.mockResolvedValue(rt);

      await service.logout('raw_token');

      expect(rt.revokedAt).not.toBeNull();
      expect(refreshTokenRepo.save).toHaveBeenCalledWith(rt);
    });

    it('should throw 401 if refresh token not found', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.logout('bad_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw 401 if refresh token already revoked', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(
        mockRefreshToken({ isRevoked: true }),
      );
      await expect(service.logout('raw_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ==========================
  // register
  // ==========================

  describe('register', () => {
    it('should create user, persist token and send activation email', async () => {
      const user = mockUser({ isActive: false });
      usersService.create.mockResolvedValue(user);
      tokenRepo.create.mockReturnValue({
        token: 'raw',
        type: TokenType.ACCOUNT_ACTIVATION,
        userId: 1,
        expiresAt: new Date(),
        usedAt: null,
      });
      tokenRepo.save.mockResolvedValue(undefined);
      mailService.sendActivationEmail.mockResolvedValue(undefined);

      await service.register({
        email: 'juan@test.com',
        password: 'pw',
        name: 'Juan',
        lastName: 'Pérez',
      });

      expect(usersService.create).toHaveBeenCalled();
      expect(tokenRepo.save).toHaveBeenCalled();
      expect(mailService.sendActivationEmail).toHaveBeenCalledWith(
        user.email,
        user.profile.name,
        expect.any(String),
      );
    });
  });

  // ==========================
  // activateAccount
  // ==========================

  describe('activateAccount', () => {
    it('should throw 400 if token not found', async () => {
      tokenRepo.findOne.mockResolvedValue(null);
      await expect(service.activateAccount('bad')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw 400 if token already used', async () => {
      tokenRepo.findOne.mockResolvedValue(mockToken({ isUsed: true }));
      await expect(service.activateAccount('raw_token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw 400 if token expired', async () => {
      tokenRepo.findOne.mockResolvedValue(mockToken({ isExpired: true }));
      await expect(service.activateAccount('raw_token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw 400 if account already active', async () => {
      tokenRepo.findOne.mockResolvedValue(mockToken());
      usersService.findOne.mockResolvedValue(mockUser({ isActive: true }));
      await expect(service.activateAccount('raw_token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should activate account and mark token as used', async () => {
      const token = mockToken();
      tokenRepo.findOne.mockResolvedValue(token);
      usersService.findOne.mockResolvedValue(mockUser({ isActive: false }));
      usersService.activate.mockResolvedValue(undefined);
      tokenRepo.save.mockResolvedValue(undefined);

      await service.activateAccount('raw_token');

      expect(usersService.activate).toHaveBeenCalledWith(1);
      expect(token.usedAt).not.toBeNull();
      expect(tokenRepo.save).toHaveBeenCalledWith(token);
    });
  });

  // ==========================
  // forgotPassword
  // ==========================

  describe('forgotPassword', () => {
    it('should return silently if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(service.forgotPassword('x@x.com')).resolves.toBeUndefined();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return silently if user not active', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser({ isActive: false }));
      await expect(
        service.forgotPassword('juan@test.com'),
      ).resolves.toBeUndefined();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should invalidate old reset tokens, create new one and send email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser());
      tokenRepo.update.mockResolvedValue(undefined);
      tokenRepo.create.mockReturnValue({
        token: 'raw',
        type: TokenType.PASSWORD_RESET,
        userId: 1,
        expiresAt: new Date(),
        usedAt: null,
      });
      tokenRepo.save.mockResolvedValue(undefined);
      mailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      await service.forgotPassword('juan@test.com');

      expect(tokenRepo.update).toHaveBeenCalledWith(
        { userId: 1, type: TokenType.PASSWORD_RESET },
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'juan@test.com',
        'Juan',
        expect.any(String),
      );
    });
  });

  // ==========================
  // resetPassword
  // ==========================

  describe('resetPassword', () => {
    it('should throw 400 if token not found', async () => {
      tokenRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad', password: 'new' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update password and invalidate all reset tokens for user', async () => {
      tokenRepo.findOne.mockResolvedValue(
        mockToken({ type: TokenType.PASSWORD_RESET }),
      );
      usersService.updatePassword.mockResolvedValue(undefined);
      tokenRepo.update.mockResolvedValue(undefined);

      await service.resetPassword({
        token: 'raw_token',
        password: 'NewPass1234!',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        1,
        'NewPass1234!',
      );
      expect(tokenRepo.update).toHaveBeenCalledWith(
        { userId: 1, type: TokenType.PASSWORD_RESET },
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
    });
  });

  // ==========================
  // changePassword
  // ==========================

  describe('changePassword', () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    };

    it('should throw 400 if user not found', async () => {
      usersService.findEntityWithPassword.mockResolvedValue(null);
      await expect(service.changePassword(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw 400 if current password does not match', async () => {
      usersService.findEntityWithPassword.mockResolvedValue(
        mockUser({ password: 'hashed_pw' }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.changePassword(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update password when current password matches', async () => {
      usersService.findEntityWithPassword.mockResolvedValue(
        mockUser({ password: 'hashed_pw' }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.updatePassword.mockResolvedValue(undefined);

      await service.changePassword(1, dto);

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        1,
        dto.newPassword,
      );
    });
  });

  // ==========================
  // logoutAll
  // ==========================

  describe('logoutAll', () => {
    it('should revoke all active refresh tokens for the user', async () => {
      refreshTokenRepo.update.mockResolvedValue({ affected: 2 });

      await service.logoutAll(1);

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1 }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('should not throw if user has no active sessions', async () => {
      refreshTokenRepo.update.mockResolvedValue({ affected: 0 });
      await expect(service.logoutAll(99)).resolves.toBeUndefined();
    });
  });
});
