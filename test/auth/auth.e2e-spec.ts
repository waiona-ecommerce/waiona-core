import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
  VersioningType,
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
import { RefreshTokenEntity } from 'src/modules/auth/entities/refresh-token.entity';
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
            entities: [
              UserEntity,
              ProfileEntity,
              RoleEntity,
              TokenEntity,
              RefreshTokenEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          UserEntity,
          ProfileEntity,
          RoleEntity,
          TokenEntity,
          RefreshTokenEntity,
        ]),
        PassportModule,
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.get('JWT_SECRET') ?? 'test_secret',
            signOptions: { expiresIn: '15m' },
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
    app.enableVersioning({ type: VersioningType.URI });
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
  let refreshToken: string;

  // =============================================
  // POST /auth/register
  // =============================================

  describe('POST /auth/register', () => {
    it('should register and return 201', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(201);
      activationToken = mockMailService.sendActivationEmail.mock.calls[0][2];
    });

    it('should return 409 if email exists', () =>
      request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(409));

    it('should return 400 with invalid body', () =>
      request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'not-email' })
        .expect(400));
  });

  // =============================================
  // POST /auth/login — cuenta inactiva
  // =============================================

  describe('POST /auth/login — inactive', () => {
    it('should return 401 if not activated', () =>
      request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(401));
  });

  // =============================================
  // GET /auth/activate
  // =============================================

  describe('GET /auth/activate', () => {
    it('should activate account', () =>
      request(app.getHttpServer())
        .get(`/v1/auth/activate?token=${activationToken}`)
        .expect(200));

    it('should return 400 if token already used', () =>
      request(app.getHttpServer())
        .get(`/v1/auth/activate?token=${activationToken}`)
        .expect(400));

    it('should return 400 if token invalid', () =>
      request(app.getHttpServer())
        .get('/v1/auth/activate?token=invalid')
        .expect(400));
  });

  // =============================================
  // POST /auth/login
  // =============================================

  describe('POST /auth/login', () => {
    it('should login and return access_token, refresh_token and user without password', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.role.type).toBe(RoleType.CLIENT);

      refreshToken = res.body.refresh_token;
    });

    it('should return 401 with wrong password', () =>
      request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: 'wrong' })
        .expect(401));
  });

  // =============================================
  // POST /auth/refresh
  // =============================================

  describe('POST /auth/refresh', () => {
    it('200 — retorna nuevos access_token y refresh_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.refresh_token).not.toBe(refreshToken);

      // guardar nuevo refresh token para próximos tests
      refreshToken = res.body.refresh_token;
    });

    it('401 — token inválido (no existe)', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refresh_token: 'token_que_no_existe' })
        .expect(401);
    });

    it('401 — token ya fue rotado (revocado)', async () => {
      // obtener un token fresco y luego rotarlo
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      const tokenToRotate = loginRes.body.refresh_token;

      // primer refresh — lo rota
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refresh_token: tokenToRotate })
        .expect(200);

      // segundo refresh con el token ya rotado → 401
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refresh_token: tokenToRotate })
        .expect(401);
    });

    it('400 — body inválido (sin refresh_token)', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  // =============================================
  // POST /auth/logout
  // =============================================

  describe('POST /auth/logout', () => {
    it('204 — revoca el refresh token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({ refresh_token: refreshToken })
        .expect(204);
    });

    it('401 — token ya revocado', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({ refresh_token: refreshToken })
        .expect(401);
    });

    it('401 — token inválido', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({ refresh_token: 'token_inexistente' })
        .expect(401);
    });

    it('400 — body inválido', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({})
        .expect(400);
    });
  });

  // =============================================
  // POST /auth/forgot-password
  // =============================================

  describe('POST /auth/forgot-password', () => {
    it('should return 200 even for unknown email — no hints', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: 'noexiste@test.com' })
        .expect(200);
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  // =============================================
  // POST /auth/reset-password
  // =============================================

  describe('POST /auth/reset-password', () => {
    it('should reset password and allow login with new password', async () => {
      const resetToken =
        mockMailService.sendPasswordResetEmail.mock.calls[0][2];
      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: resetToken, password: 'NewPass1234!' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: 'NewPass1234!' })
        .expect(200);
    });

    it('should return 400 with invalid token', () =>
      request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: 'invalid', password: 'NewPass1234!' })
        .expect(400));
  });
});
