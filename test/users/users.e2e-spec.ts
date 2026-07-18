import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../src/common/guards/roles.guard';

import { UsersController } from '../../src/modules/users/controllers/users.controller';
import { UsersService } from '../../src/modules/users/services/users.service';
import { UserEntity } from '../../src/modules/users/entities/user.entity';
import { ProfileEntity } from '../../src/modules/users/entities/profile.entity';
import { RoleEntity } from '../../src/modules/users/entities/role.entity';
import { OrderEntity } from '../../src/modules/orders/entities/order.entity';

// mockSub es mutable — el guard lo lee en cada request para simular distintos usuarios
let mockSub = 1;

// orderCount es mutable — por default no hay órdenes activas (0)
const orderCount = jest.fn().mockResolvedValue(0);

describe('Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersService: UsersService;
  let userId: number;

  const testUser = {
    email: 'test@waiona.com',
    password: 'Test1234!',
    name: 'Test',
    lastName: 'User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            host: config.get('POSTGRES_HOST'),
            port: parseInt(config.get('POSTGRES_TEST_PORT') || '5433'),
            username: config.get('POSTGRES_USER'),
            password: config.get('POSTGRES_PASSWORD'),
            database: config.get('POSTGRES_TEST_DB'),
            entities: [UserEntity, ProfileEntity, RoleEntity],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([UserEntity, RoleEntity]),
      ],
      controllers: [UsersController],
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: { count: orderCount },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { sub: mockSub };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    usersService = moduleFixture.get(UsersService);

    const created = await usersService.create(testUser);
    userId = created.id;
    mockSub = userId;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // GET ALL (admin)
  // -------------------------

  it('GET /users -> 200 retorna paginado', async () => {
    const res = await request(app.getHttpServer()).get('/v1/users').expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.page).toBe(1);
  });

  it('GET /users?email=test@waiona.com -> filtra por email completo', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users?email=test@waiona.com')
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].email).toContain('test');
  });

  it('GET /users?email=test -> búsqueda parcial de email retorna 200', async () => {
    // Antes del fix, @IsEmail() rechazaba fragmentos parciales con 400.
    // Ahora @IsString() permite cualquier fragmento y el service usa ILIKE.
    const res = await request(app.getHttpServer())
      .get('/v1/users?email=test')
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].email).toContain('test');
  });

  it('GET /users?name=Test -> filtra por nombre', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users?name=Test')
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------
  // GET ONE
  // -------------------------

  it('GET /users/:id -> 200 propio usuario', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/users/${userId}`)
      .expect(200);

    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe(testUser.email);
    expect(res.body.password).toBeUndefined();
    expect(res.body.profile.name).toBe(testUser.name);
  });

  it('GET /users/:id -> 403 si accede a otro usuario', async () => {
    mockSub = userId + 999;
    await request(app.getHttpServer()).get(`/v1/users/${userId}`).expect(403);
    mockSub = userId;
  });

  it('GET /users/999999 -> 404 si no existe', async () => {
    mockSub = 999999;
    await request(app.getHttpServer()).get('/v1/users/999999').expect(404);
    mockSub = userId;
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /users/:id -> 200 actualiza nombre', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/users/${userId}`)
      .send({ name: 'Updated' })
      .expect(200);

    expect(res.body.profile.name).toBe('Updated');
    expect(res.body.profile.lastName).toBe(testUser.lastName);
  });

  it('PATCH /users/:id -> 200 limpia avatar (null)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/users/${userId}`)
      .send({ avatar: null })
      .expect(200);

    expect(res.body.profile.avatar).toBeNull();
  });

  it('PATCH /users/:id -> 400 si body contiene email (campo no permitido)', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/users/${userId}`)
      .send({ email: 'hack@waiona.com' })
      .expect(400);
  });

  it('PATCH /users/:id -> 403 si actualiza otro usuario', async () => {
    mockSub = userId + 999;
    await request(app.getHttpServer())
      .patch(`/v1/users/${userId}`)
      .send({ name: 'Hacked' })
      .expect(403);
    mockSub = userId;
  });

  it('PATCH /users/999999 -> 404 si no existe', async () => {
    mockSub = 999999;
    await request(app.getHttpServer())
      .patch('/v1/users/999999')
      .send({ name: 'Ghost' })
      .expect(404);
    mockSub = userId;
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /users/:id -> 403 si elimina otro usuario', async () => {
    mockSub = userId + 999;
    await request(app.getHttpServer())
      .delete(`/v1/users/${userId}`)
      .expect(403);
    mockSub = userId;
  });

  it('DELETE /users/999999 -> 404 si no existe', async () => {
    mockSub = 999999;
    await request(app.getHttpServer()).delete('/v1/users/999999').expect(404);
    mockSub = userId;
  });

  it('DELETE /users/:id -> 409 si tiene órdenes activas', async () => {
    orderCount.mockResolvedValueOnce(1);
    await request(app.getHttpServer())
      .delete(`/v1/users/${userId}`)
      .expect(409);
  });

  it('DELETE /users/:id -> 204 y luego GET devuelve 404', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/users/${userId}`)
      .expect(204);

    await request(app.getHttpServer()).get(`/v1/users/${userId}`).expect(404);
  });

  it('permite volver a registrar el mismo email después del soft-delete', async () => {
    const recreated = await usersService.create(testUser);
    expect(recreated.email).toBe(testUser.email);
  });
});
