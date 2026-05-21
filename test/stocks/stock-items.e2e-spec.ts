import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { StockItemsController } from '../../src/modules/stocks/stock-item/controllers/stock-item.controller';
import { StockItemsService } from '../../src/modules/stocks/stock-item/services/stock-item.service';
import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';

import { StockMovementController } from '../../src/modules/stocks/stock-movement/controllers/stock-movement.controller';
import { StockMovementService } from '../../src/modules/stocks/stock-movement/services/stock-movement.service';
import { StockMovementEntity } from '../../src/modules/stocks/stock-movement/entities/stock-movement.entity';

import { StockWriteOffEntity } from '../../src/modules/stocks/stock-writeoff/entities/stock-writeoff.entity';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockLocationType } from '../../src/modules/stocks/stock-locations/enums/stock-location-type.enum';

import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';

describe('StockItems (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let locationId: number;
  let productId: number;
  let stockItemId: number;

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
              StockItemEntity,
              StockLocationEntity,
              StockMovementEntity,
              StockWriteOffEntity,
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
        TypeOrmModule.forFeature([
          StockItemEntity,
          StockMovementEntity,
          StockWriteOffEntity,
          ComboItemEntity,
        ]),
      ],
      controllers: [StockItemsController, StockMovementController],
      providers: [StockItemsService, StockMovementService],
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

    // Seed: category + product + location (directo vía DB, sin exponer esos endpoints en este módulo)
    const categoryRepo: Repository<CategoryEntity> =
      dataSource.getRepository(CategoryEntity);
    const productRepo: Repository<ProductEntity> =
      dataSource.getRepository(ProductEntity);
    const locationRepo: Repository<StockLocationEntity> =
      dataSource.getRepository(StockLocationEntity);

    const categoryObj = categoryRepo.create({ name: 'Electrónica' });
    const category = await categoryRepo.save(categoryObj);

    const productObj = productRepo.create({
      name: 'Notebook X1',
      sku: 'NB-X1-001',
      description: 'Notebook de prueba',
      categoryId: category.id,
    });
    const product = await productRepo.save(productObj);
    const location = await locationRepo.save(
      locationRepo.create({
        name: 'Depósito Principal',
        type: StockLocationType.WAREHOUSE,
      }),
    );

    productId = product.id;
    locationId = location.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE STOCK ITEM
  // -------------------------

  it('POST /stock-items -> 201 creates stock item', async () => {
    const res = await request(app.getHttpServer())
      .post('/stock-items')
      .send({
        productId,
        locationId,
        stockMin: 5,
        stockCritical: 2,
        stockMax: 100,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.productId).toBe(productId);
    expect(res.body.quantityCurrent).toBe(0);
    expect(res.body.quantityAvailable).toBe(0);

    stockItemId = res.body.id;
  });

  it('POST /stock-items -> 409 when product+location already exists', async () => {
    await request(app.getHttpServer())
      .post('/stock-items')
      .send({ productId, locationId, stockMin: 5, stockCritical: 2 })
      .expect(409);
  });

  it('POST /stock-items -> 400 when stockCritical >= stockMin', async () => {
    await request(app.getHttpServer())
      .post('/stock-items')
      .send({ productId: 9999, locationId, stockMin: 5, stockCritical: 5 })
      .expect(400);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /stock-items -> 200 returns paginated items', async () => {
    const res = await request(app.getHttpServer())
      .get('/stock-items')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  // -------------------------
  // GET BY ID
  // -------------------------

  it('GET /stock-items/:id -> 200 returns item with movements', async () => {
    const res = await request(app.getHttpServer())
      .get(`/stock-items/${stockItemId}`)
      .expect(200);

    expect(res.body.id).toBe(stockItemId);
    expect(Array.isArray(res.body.movements)).toBe(true);
  });

  it('GET /stock-items/:id -> 404 when not found', async () => {
    await request(app.getHttpServer()).get('/stock-items/999999').expect(404);
  });

  // -------------------------
  // ADD STOCK
  // -------------------------

  it('POST /stock-items/add-stock -> 201 adds stock and creates movement', async () => {
    const res = await request(app.getHttpServer())
      .post('/stock-items/add-stock')
      .send({ productId, locationId, quantity: 50 })
      .expect(201);

    expect(res.body.quantityCurrent).toBe(50);
    expect(res.body.quantityAvailable).toBe(50);
    expect(res.body.movements).toHaveLength(1);
    expect(res.body.movements[0].operationType).toBe('ENTRY');
  });

  it('POST /stock-items/add-stock -> 400 when quantity is 0', async () => {
    await request(app.getHttpServer())
      .post('/stock-items/add-stock')
      .send({ productId, locationId, quantity: 0 })
      .expect(400);
  });

  it('POST /stock-items/add-stock -> 404 when stock item does not exist', async () => {
    await request(app.getHttpServer())
      .post('/stock-items/add-stock')
      .send({ productId: 9999, locationId, quantity: 10 })
      .expect(404);
  });

  // -------------------------
  // WRITE OFF
  // -------------------------

  it('POST /stock-items/write-off -> 201 reduces available stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/stock-items/write-off')
      .send({ stockItemId, quantity: 5 })
      .expect(201);

    expect(res.body.quantityCurrent).toBe(45);
  });

  it('POST /stock-items/write-off -> 400 when insufficient available stock', async () => {
    await request(app.getHttpServer())
      .post('/stock-items/write-off')
      .send({ stockItemId, quantity: 9999 })
      .expect(400);
  });

  // -------------------------
  // UPDATE THRESHOLDS
  // -------------------------

  it('PATCH /stock-items/:id/thresholds -> 200 updates thresholds', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/stock-items/${stockItemId}/thresholds`)
      .send({ stockMin: 10, stockCritical: 3, stockMax: 200 })
      .expect(200);

    expect(res.body.stockMin).toBe(10);
    expect(res.body.stockCritical).toBe(3);
    expect(res.body.stockMax).toBe(200);
  });

  it('PATCH /stock-items/:id/thresholds -> 400 when stockCritical >= stockMin', async () => {
    await request(app.getHttpServer())
      .patch(`/stock-items/${stockItemId}/thresholds`)
      .send({ stockMin: 5, stockCritical: 5 })
      .expect(400);
  });

  it('PATCH /stock-items/:id/thresholds -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .patch('/stock-items/999999/thresholds')
      .send({ stockMin: 5, stockCritical: 2 })
      .expect(404);
  });

  // -------------------------
  // STOCK MOVEMENTS (read)
  // -------------------------

  it('GET /stock-movements -> 200 returns paginated movements', async () => {
    const res = await request(app.getHttpServer())
      .get('/stock-movements')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('GET /stock-movements/stock-item/:id -> 200 returns movements for item', async () => {
    const res = await request(app.getHttpServer())
      .get(`/stock-movements/stock-item/${stockItemId}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /stock-movements/:id -> 200 returns one movement', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/stock-movements')
      .expect(200);

    const movementId = listRes.body.data[0].id;

    const res = await request(app.getHttpServer())
      .get(`/stock-movements/${movementId}`)
      .expect(200);

    expect(res.body.id).toBe(movementId);
    expect(res.body.quantity).toBeDefined();
  });

  it('GET /stock-movements/:id -> 404 when not found', async () => {
    await request(app.getHttpServer())
      .get('/stock-movements/999999')
      .expect(404);
  });
});
