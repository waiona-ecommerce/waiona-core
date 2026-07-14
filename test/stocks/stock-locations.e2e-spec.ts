import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../src/common/guards/roles.guard';

import { getRepositoryToken } from '@nestjs/typeorm';

import { StockLocationsController } from '../../src/modules/stocks/stock-locations/controllers/stock-locations.controller';
import { StockLocationsService } from '../../src/modules/stocks/stock-locations/services/stock-locations.service';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';
import { StockLocationType } from '../../src/modules/stocks/stock-locations/enums/stock-location-type.enum';

describe('StockLocations (e2e)', () => {
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
            entities: [StockLocationEntity],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([StockLocationEntity]),
      ],
      controllers: [StockLocationsController],
      providers: [
        StockLocationsService,
        {
          provide: getRepositoryToken(StockItemEntity),
          useValue: { count: jest.fn().mockResolvedValue(0) },
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
  // Nota: StockLocationsService solo permite una ubicación activa a la vez
  // (regla de negocio), por eso estos tests corren en secuencia sobre la
  // misma ubicación en vez de crear una por test.

  let locationId: number;

  it('POST /stock-locations -> 201 creates a warehouse location', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/stock-locations')
      .send({ name: 'Depósito Central', type: StockLocationType.WAREHOUSE })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('DEPÓSITO CENTRAL');
    expect(res.body.type).toBe(StockLocationType.WAREHOUSE);
    expect(res.body.address).toBeUndefined();

    locationId = res.body.id;
  });

  it('POST /stock-locations -> 409 when an active location already exists', async () => {
    await request(app.getHttpServer())
      .post('/v1/stock-locations')
      .send({
        name: 'Sucursal Palermo',
        type: StockLocationType.STORE,
        address: 'Av. Santa Fe 1234',
      })
      .expect(409);
  });

  it('POST /stock-locations -> 400 when name is missing', async () => {
    await request(app.getHttpServer())
      .post('/v1/stock-locations')
      .send({ type: StockLocationType.WAREHOUSE })
      .expect(400);
  });

  it('POST /stock-locations -> 400 when type is invalid', async () => {
    await request(app.getHttpServer())
      .post('/v1/stock-locations')
      .send({ name: 'Test', type: 'INVALID_TYPE' })
      .expect(400);
  });

  it('POST /stock-locations -> 400 when name is too short', async () => {
    await request(app.getHttpServer())
      .post('/v1/stock-locations')
      .send({ name: 'AB', type: StockLocationType.WAREHOUSE })
      .expect(400);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /stock-locations -> 200 returns paginated locations', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/stock-locations')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  // -------------------------
  // GET ONE
  // -------------------------

  it('GET /stock-locations/:id -> 200 returns location', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/stock-locations/${locationId}`)
      .expect(200);

    expect(res.body.name).toBe('DEPÓSITO CENTRAL');
  });

  it('GET /stock-locations/:id -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .get('/v1/stock-locations/999999')
      .expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /stock-locations/:id -> 200 updates name', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/stock-locations/${locationId}`)
      .send({ name: 'Actualizado' })
      .expect(200);

    expect(res.body.name).toBe('ACTUALIZADO');
  });

  it('PATCH /stock-locations/:id -> 200 sets address', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/stock-locations/${locationId}`)
      .send({ address: 'Calle 123' })
      .expect(200);

    expect(res.body.address).toBe('Calle 123');
  });

  it('PATCH /stock-locations/:id -> 200 clears address with null', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/stock-locations/${locationId}`)
      .send({ address: null })
      .expect(200);

    expect(res.body.address).toBeUndefined();
  });

  it('PATCH /stock-locations/:id -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .patch('/v1/stock-locations/999999')
      .send({ name: 'Test' })
      .expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /stock-locations/:id -> 204 then 404', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/stock-locations/${locationId}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/stock-locations/${locationId}`)
      .expect(404);
  });

  it('DELETE /stock-locations/:id -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .delete('/v1/stock-locations/999999')
      .expect(404);
  });

  it('POST /stock-locations -> 201 allows creating again after the only location was deleted', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/stock-locations')
      .send({ name: 'Depósito Nuevo', type: StockLocationType.WAREHOUSE })
      .expect(201);

    expect(res.body.id).toBeDefined();
  });
});
