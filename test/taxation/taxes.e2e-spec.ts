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

import { TaxesController } from '../../src/modules/taxation/taxes/controllers/taxes.controller';
import { TaxesService } from '../../src/modules/taxation/taxes/services/taxes.service';
import { TaxEntity } from '../../src/modules/taxation/taxes/entities/tax.entity';
import { ProductTaxEntity } from '../../src/modules/taxation/product-taxes/entities/product-taxes.entity';

// productTaxFindOne es mutable — por default el impuesto no está asignado a ningún producto
const productTaxFindOne = jest.fn().mockResolvedValue(null);

describe('Taxes (e2e)', () => {
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
            entities: [TaxEntity],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([TaxEntity]),
      ],
      controllers: [TaxesController],
      providers: [
        TaxesService,
        {
          provide: getRepositoryToken(ProductTaxEntity),
          useValue: { findOne: productTaxFindOne },
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

  it('POST /taxes → 201 crea un impuesto', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'IVA', name: 'Impuesto al Valor Agregado', value: 21 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.code).toBe('IVA');
    expect(res.body.value).toBe(21);
    expect(res.body.isGlobal).toBe(false);
  });

  it('POST /taxes → 201 con isGlobal true', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'IIBB', name: 'Ingresos Brutos', value: 3, isGlobal: true })
      .expect(201);

    expect(res.body.isGlobal).toBe(true);
  });

  it('POST /taxes → 400 si campo desconocido', async () => {
    await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'TEST1', name: 'Test Tax', value: 5, isPercentage: true })
      .expect(400);
  });

  it('POST /taxes → 400 si value negativo', async () => {
    await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'NEG', name: 'Negativo Tax', value: -1 })
      .expect(400);
  });

  it('POST /taxes → 400 si value mayor a 100', async () => {
    await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'OVER', name: 'Over Cien Tax', value: 101 })
      .expect(400);
  });

  it('POST /taxes → normaliza el code a mayúsculas y sin espacios', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: '  lower  ', name: 'Lower Case Tax', value: 2 })
      .expect(201);

    expect(res.body.code).toBe('LOWER');
  });

  it('POST /taxes → 409 si código duplicado', async () => {
    await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'DUPE', name: 'Primer Dupe Tax', value: 5 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'DUPE', name: 'Segundo Dupe Tax', value: 10 })
      .expect(409);
  });

  // -------------------------
  // FIND ALL
  // -------------------------

  it('GET /taxes → 200 retorna paginado', async () => {
    const res = await request(app.getHttpServer()).get('/v1/taxes').expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('GET /taxes?page=&limit= → respeta la paginación', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/taxes?page=1&limit=1')
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(1);
  });

  // -------------------------
  // FIND ONE
  // -------------------------

  it('GET /taxes/:id → 200 retorna uno', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'GETSINGLE', name: 'Get Single Tax', value: 10.5 });

    const res = await request(app.getHttpServer())
      .get(`/v1/taxes/${created.body.id}`)
      .expect(200);

    expect(res.body.value).toBe(10.5);
  });

  it('GET /taxes/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/v1/taxes/999999').expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /taxes/:id → 200 actualiza value', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'PATCH1', name: 'Para Parchear Tax', value: 5 });

    const res = await request(app.getHttpServer())
      .patch(`/v1/taxes/${created.body.id}`)
      .send({ value: 8 })
      .expect(200);

    expect(res.body.value).toBe(8);
  });

  it('PATCH /taxes/:id → 400 si campo desconocido', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'PATCH2', name: 'Para Parchear Dos Tax', value: 21 });

    await request(app.getHttpServer())
      .patch(`/v1/taxes/${created.body.id}`)
      .send({ currency: 'ARS' })
      .expect(400);
  });

  it('PATCH /taxes/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/v1/taxes/999999')
      .send({ value: 10 })
      .expect(404);
  });

  it('PATCH /taxes/:id → 409 si el nuevo código ya existe', async () => {
    await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'TAKEN', name: 'Codigo Existente Tax', value: 4 });

    const created = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'PATCHCONFLICT', name: 'Para Conflicto Tax', value: 4 });

    await request(app.getHttpServer())
      .patch(`/v1/taxes/${created.body.id}`)
      .send({ code: 'TAKEN' })
      .expect(409);
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /taxes/:id → 409 si está asignado a un producto', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'ASSIGNED', name: 'Asignado a Producto Tax', value: 7 });

    productTaxFindOne.mockResolvedValueOnce({
      id: 1,
      taxId: created.body.id,
      productId: 1,
    });

    await request(app.getHttpServer())
      .delete(`/v1/taxes/${created.body.id}`)
      .expect(409);
  });

  it('DELETE /taxes/:id → 204 y luego 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/taxes')
      .send({ code: 'DEL1', name: 'Para Borrar Tax', value: 3 });

    await request(app.getHttpServer())
      .delete(`/v1/taxes/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/taxes/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /taxes/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).delete('/v1/taxes/999999').expect(404);
  });
});
