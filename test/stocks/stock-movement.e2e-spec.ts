import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { StockMovementController } from '../../src/modules/stocks/stock-movement/controllers/stock-movement.controller';
import { StockMovementService } from '../../src/modules/stocks/stock-movement/services/stock-movement.service';
import { StockMovementEntity } from '../../src/modules/stocks/stock-movement/entities/stock-movement.entity';
import { StockOperationType } from '../../src/modules/stocks/stock-movement/enums/stock-operation-type.enum';
import { StockFlow } from '../../src/modules/stocks/stock-movement/enums/stock-flow.enum';
import { StockReferenceType } from '../../src/modules/stocks/stock-movement/enums/stock-reference.enum';

import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockLocationType } from '../../src/modules/stocks/stock-locations/enums/stock-location-type.enum';
import { StockWriteOffEntity } from '../../src/modules/stocks/stock-writeoff/entities/stock-writeoff.entity';

import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

describe('StockMovement (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let stockItemId: number;
  let movementId: number;

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
              StockMovementEntity,
              StockItemEntity,
              StockLocationEntity,
              StockWriteOffEntity,
              ProductEntity,
              ProductImageEntity,
              CategoryEntity,
              ComboEntity,
              ComboItemEntity,
              ComboImageEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([StockMovementEntity]),
      ],
      controllers: [StockMovementController],
      providers: [StockMovementService],
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

    // Seed: category → product → location → stockItem → movement
    const categoryRepo = dataSource.getRepository(CategoryEntity);
    const productRepo = dataSource.getRepository(ProductEntity);
    const locationRepo = dataSource.getRepository(StockLocationEntity);
    const stockRepo = dataSource.getRepository(StockItemEntity);
    const movementRepo = dataSource.getRepository(StockMovementEntity);

    const category = await categoryRepo.save(
      categoryRepo.create({ name: 'Test Category' }),
    );
    const product = await productRepo.save(
      productRepo.create({
        sku: 'SM-001',
        name: 'Test Product',
        description: 'Stock movement e2e',
        isActive: true,
        categoryId: category.id,
        measurementUnit: ProductMeasurementUnit.UNIT,
      }),
    );
    const location = await locationRepo.save(
      locationRepo.create({
        name: 'Depósito Test',
        type: StockLocationType.WAREHOUSE,
      }),
    );
    const stockItem = await stockRepo.save(
      stockRepo.create({
        productId: product.id,
        locationId: location.id,
        quantityCurrent: 50,
        quantityReserved: 0,
      }),
    );
    stockItemId = stockItem.id;

    // Movimientos seeded directamente — el service los crea internamente, no hay POST endpoint
    const movement = await movementRepo.save(
      movementRepo.create({
        stockItemId: stockItem.id,
        operationType: StockOperationType.ENTRY,
        stockFlow: StockFlow.INBOUND,
        quantity: 50,
        referenceType: StockReferenceType.MANUAL,
        referenceId: null,
      }),
    );
    movementId = movement.id;

    // Segundo movimiento para verificar orden DESC y listado
    await movementRepo.save(
      movementRepo.create({
        stockItemId: stockItem.id,
        operationType: StockOperationType.EXIT,
        stockFlow: StockFlow.OUTBOUND,
        quantity: 5,
        referenceType: StockReferenceType.ORDER,
        referenceId: 42,
      }),
    );
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // GET /stock-movements
  // =============================================

  describe('GET /stock-movements', () => {
    it('200 — retorna lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/stock-movements')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBeDefined();
    });

    it('200 — respeta limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/stock-movements?page=1&limit=1')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.limit).toBe(1);
    });

    it('200 — page 2 con limit=1 devuelve el segundo registro', async () => {
      const res = await request(app.getHttpServer())
        .get('/stock-movements?page=2&limit=1')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBe(2);
    });
  });

  // =============================================
  // GET /stock-movements/stock-item/:stockItemId
  // =============================================

  describe('GET /stock-movements/stock-item/:stockItemId', () => {
    it('200 — retorna movimientos del stock item ordenados DESC', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-movements/stock-item/${stockItemId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0].stockItemId).toBe(stockItemId);
    });

    it('200 — retorna array vacío para stockItemId sin movimientos', async () => {
      const res = await request(app.getHttpServer())
        .get('/stock-movements/stock-item/999999')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('200 — los campos del DTO son correctos', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-movements/stock-item/${stockItemId}`)
        .expect(200);

      const movement = res.body[0];
      expect(movement.id).toBeDefined();
      expect(movement.stockItemId).toBe(stockItemId);
      expect(movement.operationType).toBeDefined();
      expect(movement.stockFlow).toBeDefined();
      expect(movement.quantity).toBeGreaterThan(0);
      expect(movement.referenceType).toBeDefined();
      expect(movement.createdAt).toBeDefined();
    });
  });

  // =============================================
  // GET /stock-movements/:id
  // =============================================

  describe('GET /stock-movements/:id', () => {
    it('200 — retorna un movimiento por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-movements/${movementId}`)
        .expect(200);

      expect(res.body.id).toBe(movementId);
      expect(res.body.stockItemId).toBe(stockItemId);
      expect(res.body.operationType).toBe(StockOperationType.ENTRY);
      expect(res.body.stockFlow).toBe(StockFlow.INBOUND);
      expect(res.body.quantity).toBe(50);
      expect(res.body.referenceType).toBe(StockReferenceType.MANUAL);
    });

    it('200 — referenceId es null cuando el tipo es MANUAL', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-movements/${movementId}`)
        .expect(200);

      expect(res.body.referenceId).toBeUndefined();
    });

    it('404 — movimiento no encontrado', async () => {
      await request(app.getHttpServer())
        .get('/stock-movements/999999')
        .expect(404);
    });
  });
});
