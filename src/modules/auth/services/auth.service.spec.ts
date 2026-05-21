import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { UsersService } from '../../users/services/users.service';
import { MailService } from 'src/modules/mail/services/mail.service';
import { TokenEntity } from 'src/modules/mail/entities/token.entity';
import { TokenType } from 'src/modules/mail/enum/token-type.enum';
import { RoleType } from 'src/common/enums/role-type.enum';
import { UserEntity } from '../../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;
  let mailService: any;
  let tokenRepo: any;

  const mockUsersService = () => ({
    findByEmail: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    activate: jest.fn(),
    updatePassword: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useFactory: mockUsersService },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: MailService, useFactory: mockMailService },
        { provide: getRepositoryToken(TokenEntity), useFactory: mockTokenRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    tokenRepo = module.get(getRepositoryToken(TokenEntity));
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
});
