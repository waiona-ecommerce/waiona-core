import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../src/common/guards/roles.guard';

import { MarginsController } from '../../src/modules/margins/controllers/margins.controller';
import { MarginsService } from '../../src/modules/margins/services/margins.service';
import { MarginEntity } from '../../src/modules/margins/entities/margin.entity';
import { ProductPricingEntity } from '../../src/modules/pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from '../../src/modules/pricing/entities/combo-pricing.entity';

// ProductPricingEntity y ComboPricingEntity tienen relaciones a ProductEntity/ComboEntity
// que arrastran muchas dependencias. Los mockeamos para mantener el e2e aislado.
// El caso 409 "margen en uso" está cubierto por los unit tests del service.
const mockPricingRepo = () => ({ findOne: jest.fn().mockResolvedValue(null) });

describe('Margins (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
            entities: [MarginEntity],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([MarginEntity]),
      ],
      controllers: [MarginsController],
      providers: [
        MarginsService,
        {
          provide: getRepositoryToken(ProductPricingEntity),
          useFactory: mockPricingRepo,
        },
        {
          provide: getRepositoryToken(ComboPricingEntity),
          useFactory: mockPricingRepo,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
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
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /margins -> 201 crea margen porcentual', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'General 20%', value: 20 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('GENERAL 20%');
    expect(res.body.value).toBe(20);
  });

  it('POST /margins -> 400 si se envía campo desconocido isPercentage', async () => {
    await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Con isPercentage', value: 20, isPercentage: true })
      .expect(400);
  });

  it('POST /margins -> 400 si faltan campos', async () => {
    await request(app.getHttpServer()).post('/v1/margins').send({}).expect(400);
  });

  it('POST /margins -> 400 si value supera 1000', async () => {
    await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Invalido', value: 1001 })
      .expect(400);
  });

  it('POST /margins -> 400 si value es negativo', async () => {
    await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Negativo', value: -5 })
      .expect(400);
  });

  it('POST /margins -> 409 si el nombre ya existe', async () => {
    await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Duplicado', value: 10 });

    await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Duplicado', value: 15 })
      .expect(409);
  });

  it('POST /margins -> 201 permite recrear un margen con el mismo nombre si fue eliminado', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Reutilizable', value: 10 });

    await request(app.getHttpServer())
      .delete(`/v1/margins/${createRes.body.id}`)
      .expect(204);

    const recreateRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Reutilizable', value: 25 })
      .expect(201);

    expect(recreateRes.body.name).toBe('REUTILIZABLE');
    expect(recreateRes.body.value).toBe(25);
    expect(recreateRes.body.id).not.toBe(createRes.body.id);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /margins -> 200 retorna paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/margins')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
  });

  it('GET /margins?page=1&limit=2 -> respeta paginación', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/margins?page=1&limit=2')
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.limit).toBe(2);
  });

  // -------------------------
  // GET ONE
  // -------------------------

  it('GET /margins/:id -> 200 retorna el margen', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Para buscar', value: 10 });

    const res = await request(app.getHttpServer())
      .get(`/v1/margins/${createRes.body.id}`)
      .expect(200);

    expect(res.body.id).toBe(createRes.body.id);
    expect(res.body.name).toBe('PARA BUSCAR');
  });

  it('GET /margins/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/v1/margins/999999').expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /margins/:id -> 200 actualiza el valor', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Para actualizar', value: 10 });

    const res = await request(app.getHttpServer())
      .patch(`/v1/margins/${createRes.body.id}`)
      .send({ value: 25 })
      .expect(200);

    expect(res.body.value).toBe(25);
    expect(res.body.name).toBe('PARA ACTUALIZAR');
  });

  it('PATCH /margins/:id -> 200 actualiza el nombre', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Nombre viejo', value: 10 });

    const res = await request(app.getHttpServer())
      .patch(`/v1/margins/${createRes.body.id}`)
      .send({ name: 'Nombre nuevo' })
      .expect(200);

    expect(res.body.name).toBe('NOMBRE NUEVO');
  });

  it('PATCH /margins/:id -> 400 si value supera 1000', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Check maximo', value: 10 });

    await request(app.getHttpServer())
      .patch(`/v1/margins/${createRes.body.id}`)
      .send({ value: 1001 })
      .expect(400);
  });

  it('PATCH /margins/:id -> 409 si el nuevo nombre ya existe', async () => {
    await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Nombre existente', value: 10 });

    const createRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Otro margen', value: 5 });

    await request(app.getHttpServer())
      .patch(`/v1/margins/${createRes.body.id}`)
      .send({ name: 'Nombre existente' })
      .expect(409);
  });

  it('PATCH /margins/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/v1/margins/999999')
      .send({ value: 10 })
      .expect(404);
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /margins/:id -> 204 y luego 404', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/margins')
      .send({ name: 'Para eliminar', value: 5 });

    await request(app.getHttpServer())
      .delete(`/v1/margins/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/margins/${createRes.body.id}`)
      .expect(404);
  });

  it('DELETE /margins/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer()).delete('/v1/margins/999999').expect(404);
  });
});
