import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from 'src/modules/auth/controllers/auth.controller';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { LocalStrategy } from 'src/modules/auth/strategies/local.strategy';
import { JwtStrategy } from 'src/modules/auth/strategies/jwt.strategy';
import { UsersService } from 'src/modules/users/services/users.service';
import { MailService } from 'src/modules/mail/services/mail.service';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { ProfileEntity } from 'src/modules/users/entities/profile.entity';
import { RoleEntity } from 'src/modules/users/entities/role.entity';
import { TokenEntity } from 'src/modules/mail/entities/token.entity';
import { RoleType } from 'src/common/enums/role-type.enum';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const mockMailService = {
    sendActivationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            host: config.get('POSTGRES_HOST') ?? 'localhost',
            port: parseInt(config.get('POSTGRES_TEST_PORT') ?? '5433'),
            username: config.get('POSTGRES_USER'),
            password: config.get('POSTGRES_PASSWORD'),
            database: config.get('POSTGRES_TEST_DB') ?? 'waiona_test',
            entities: [UserEntity, ProfileEntity, RoleEntity, TokenEntity],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          UserEntity,
          ProfileEntity,
          RoleEntity,
          TokenEntity,
        ]),
        PassportModule,
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.get('JWT_SECRET') ?? 'test_secret',
            signOptions: { expiresIn: '1d' },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        UsersService,
        LocalStrategy,
        JwtStrategy,
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const roleRepo = dataSource.getRepository(RoleEntity);
    await roleRepo.save(roleRepo.create({ type: RoleType.CLIENT }));
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  const testUser = {
    email: 'test@waiona.com',
    password: 'Test1234!',
    name: 'Test',
    lastName: 'User',
  };
  let activationToken: string;

  describe('POST /auth/register', () => {
    it('should register and return 201', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);
      activationToken = mockMailService.sendActivationEmail.mock.calls[0][2];
    });

    it('should return 409 if email exists', () =>
      request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409));

    it('should return 400 with invalid body', () =>
      request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-email' })
        .expect(400));
  });

  describe('POST /auth/login — inactive', () => {
    it('should return 401 if not activated', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(401));
  });

  describe('GET /auth/activate', () => {
    it('should activate account', () =>
      request(app.getHttpServer())
        .get(`/auth/activate?token=${activationToken}`)
        .expect(200));

    it('should return 400 if token already used', () =>
      request(app.getHttpServer())
        .get(`/auth/activate?token=${activationToken}`)
        .expect(400));

    it('should return 400 if token invalid', () =>
      request(app.getHttpServer())
        .get('/auth/activate?token=invalid')
        .expect(400));
  });

  describe('POST /auth/login', () => {
    it('should login and return 200 with token and no password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.role.type).toBe(RoleType.CLIENT);
    });

    it('should return 401 with wrong password', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrong' })
        .expect(401));
  });

  describe('POST /auth/forgot-password', () => {
    it('should return 200 even for unknown email — no hints', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'noexiste@test.com' })
        .expect(200);
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password and allow login with new password', async () => {
      const resetToken =
        mockMailService.sendPasswordResetEmail.mock.calls[0][2];
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'NewPass1234!' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'NewPass1234!' })
        .expect(200);
    });

    it('should return 400 with invalid token', () =>
      request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid', password: 'NewPass1234!' })
        .expect(400));
  });
});
