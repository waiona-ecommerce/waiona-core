import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../src/common/guards/roles.guard';

import { StockLocationsController } from '../../src/modules/stocks/stock-locations/controllers/stock-locations.controller';
import { StockLocationsService } from '../../src/modules/stocks/stock-locations/services/stock-locations.service';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';
import { StockMovementEntity } from '../../src/modules/stocks/stock-movement/entities/stock-movement.entity';
import { StockLocationType } from '../../src/modules/stocks/stock-locations/enums/stock-location-type.enum';

import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';

describe('StockLocations (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productId: number;

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
            entities: [
              StockLocationEntity,
              StockItemEntity,
              StockMovementEntity,
              ProductEntity,
              ProductImageEntity,
              CategoryEntity,
              ComboItemEntity,
              ComboEntity,
              ComboImageEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([StockLocationEntity, StockItemEntity]),
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

    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    // Seed: category + product (directo vía DB, sin exponer esos endpoints en este módulo)
    const categoryRepo: Repository<CategoryEntity> =
      dataSource.getRepository(CategoryEntity);
    const productRepo: Repository<ProductEntity> =
      dataSource.getRepository(ProductEntity);

    const category = await categoryRepo.save(
      categoryRepo.create({ name: 'Electrónica' }),
    );
    const product = await productRepo.save(
      productRepo.create({
        name: 'Notebook X1',
        sku: 'NB-X1-001',
        description: 'Notebook de prueba',
        categoryId: category.id,
      }),
    );
    productId = product.id;
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

  it('DELETE /stock-locations/:id -> 409 when location has stock items assigned', async () => {
    const stockItemRepo = dataSource.getRepository(StockItemEntity);
    const stockItem = await stockItemRepo.save(
      stockItemRepo.create({
        productId,
        locationId,
        stockMin: 1,
        stockCritical: 0,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/v1/stock-locations/${locationId}`)
      .expect(409);

    await stockItemRepo.delete(stockItem.id); // limpia para que el DELETE exitoso funcione después
  });

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
