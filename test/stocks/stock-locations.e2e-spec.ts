import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { StockLocationsController } from '../../src/modules/stocks/stock-locations/controllers/stock-locations.controller';
import { StockLocationsService } from '../../src/modules/stocks/stock-locations/services/stock-locations.service';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
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
      providers: [StockLocationsService],
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

  it('POST /stock-locations -> 201 creates a warehouse location', async () => {
    const res = await request(app.getHttpServer())
      .post('/stock-locations')
      .send({ name: 'Depósito Central', type: StockLocationType.WAREHOUSE })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Depósito Central');
    expect(res.body.type).toBe(StockLocationType.WAREHOUSE);
    expect(res.body.address).toBeUndefined();
  });

  it('POST /stock-locations -> 201 creates a store location with address', async () => {
    const res = await request(app.getHttpServer())
      .post('/stock-locations')
      .send({
        name: 'Sucursal Palermo',
        type: StockLocationType.STORE,
        address: 'Av. Santa Fe 1234',
      })
      .expect(201);

    expect(res.body.address).toBe('Av. Santa Fe 1234');
  });

  it('POST /stock-locations -> 400 when name is missing', async () => {
    await request(app.getHttpServer())
      .post('/stock-locations')
      .send({ type: StockLocationType.WAREHOUSE })
      .expect(400);
  });

  it('POST /stock-locations -> 400 when type is invalid', async () => {
    await request(app.getHttpServer())
      .post('/stock-locations')
      .send({ name: 'Test', type: 'INVALID_TYPE' })
      .expect(400);
  });

  it('POST /stock-locations -> 400 when name is too short', async () => {
    await request(app.getHttpServer())
      .post('/stock-locations')
      .send({ name: 'AB', type: StockLocationType.WAREHOUSE })
      .expect(400);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /stock-locations -> 200 returns paginated locations', async () => {
    const res = await request(app.getHttpServer())
      .get('/stock-locations')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  // -------------------------
  // GET ONE
  // -------------------------

  it('GET /stock-locations/:id -> 200 returns location', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/stock-locations')
      .send({ name: 'Depósito Norte', type: StockLocationType.WAREHOUSE });

    const res = await request(app.getHttpServer())
      .get(`/stock-locations/${createRes.body.id}`)
      .expect(200);

    expect(res.body.name).toBe('Depósito Norte');
  });

  it('GET /stock-locations/:id -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .get('/stock-locations/999999')
      .expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /stock-locations/:id -> 200 updates name', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/stock-locations')
      .send({ name: 'Original', type: StockLocationType.WAREHOUSE });

    const res = await request(app.getHttpServer())
      .patch(`/stock-locations/${createRes.body.id}`)
      .send({ name: 'Actualizado' })
      .expect(200);

    expect(res.body.name).toBe('Actualizado');
  });

  it('PATCH /stock-locations/:id -> 200 clears address with null', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/stock-locations')
      .send({
        name: 'Con Dirección',
        type: StockLocationType.STORE,
        address: 'Calle 123',
      });

    const res = await request(app.getHttpServer())
      .patch(`/stock-locations/${createRes.body.id}`)
      .send({ address: null })
      .expect(200);

    expect(res.body.address).toBeUndefined();
  });

  it('PATCH /stock-locations/:id -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .patch('/stock-locations/999999')
      .send({ name: 'Test' })
      .expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /stock-locations/:id -> 204 then 404', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/stock-locations')
      .send({ name: 'A Eliminar', type: StockLocationType.WAREHOUSE });

    await request(app.getHttpServer())
      .delete(`/stock-locations/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/stock-locations/${createRes.body.id}`)
      .expect(404);
  });

  it('DELETE /stock-locations/:id -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .delete('/stock-locations/999999')
      .expect(404);
  });
});
