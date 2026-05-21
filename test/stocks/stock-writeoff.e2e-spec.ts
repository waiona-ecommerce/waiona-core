import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { StockWriteOffController } from '../../src/modules/stocks/stock-writeoff/controllers/stock-writeoff.controller';
import { StockWriteOffService } from '../../src/modules/stocks/stock-writeoff/services/stock-writeoff.service';
import { StockWriteOffEntity } from '../../src/modules/stocks/stock-writeoff/entities/stock-writeoff.entity';
import { StockWriteOffReason } from '../../src/modules/stocks/stock-writeoff/enums/stock-writeoff-reason.enum';

import { StockMovementEntity } from '../../src/modules/stocks/stock-movement/entities/stock-movement.entity';
import { StockOperationType } from '../../src/modules/stocks/stock-movement/enums/stock-operation-type.enum';
import { StockFlow } from '../../src/modules/stocks/stock-movement/enums/stock-flow.enum';
import { StockReferenceType } from '../../src/modules/stocks/stock-movement/enums/stock-reference.enum';

import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockLocationType } from '../../src/modules/stocks/stock-locations/enums/stock-location-type.enum';

import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

describe('StockWriteOff (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let stockItemId: number;
  let writeOffId: number;

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
              StockWriteOffEntity,
              StockMovementEntity,
              StockItemEntity,
              StockLocationEntity,
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
        TypeOrmModule.forFeature([StockWriteOffEntity]),
      ],
      controllers: [StockWriteOffController],
      providers: [StockWriteOffService],
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

    // Seed: category → product → location → stockItem → movement → writeOff
    // Los write-offs los crea internamente el service al hacer bajas, no hay POST endpoint
    const categoryRepo = dataSource.getRepository(CategoryEntity);
    const productRepo = dataSource.getRepository(ProductEntity);
    const locationRepo = dataSource.getRepository(StockLocationEntity);
    const stockRepo = dataSource.getRepository(StockItemEntity);
    const movementRepo = dataSource.getRepository(StockMovementEntity);
    const writeOffRepo = dataSource.getRepository(StockWriteOffEntity);

    const category = await categoryRepo.save(
      categoryRepo.create({ name: 'Test Category' }),
    );
    const product = await productRepo.save(
      productRepo.create({
        sku: 'WO-001',
        name: 'Test Product',
        description: 'Write-off e2e',
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

    // Movimiento asociado a la baja (DAMAGE/OUTBOUND)
    const movement = await movementRepo.save(
      movementRepo.create({
        stockItemId: stockItem.id,
        operationType: StockOperationType.DAMAGE,
        stockFlow: StockFlow.OUTBOUND,
        quantity: 3,
        referenceType: StockReferenceType.DAMAGE_REPORT,
        referenceId: null,
      }),
    );

    const writeOff = await writeOffRepo.save(
      writeOffRepo.create({
        stockItemId: stockItem.id,
        movementId: movement.id,
        quantity: 3,
        reason: StockWriteOffReason.DAMAGED,
        description: 'Cajas rotas en tránsito',
        reportedBy: 1,
      }),
    );
    writeOffId = writeOff.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // GET /stock-write-offs
  // =============================================

  describe('GET /stock-write-offs', () => {
    it('200 — retorna lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/stock-write-offs')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBeDefined();
    });

    it('200 — respeta limit y page', async () => {
      const res = await request(app.getHttpServer())
        .get('/stock-write-offs?page=1&limit=1')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.limit).toBe(1);
    });
  });

  // =============================================
  // GET /stock-write-offs/stock-item/:stockItemId
  // =============================================

  describe('GET /stock-write-offs/stock-item/:stockItemId', () => {
    it('200 — retorna bajas del stock item', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-write-offs/stock-item/${stockItemId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].stockItemId).toBe(stockItemId);
    });

    it('200 — retorna array vacío para stockItemId sin bajas', async () => {
      const res = await request(app.getHttpServer())
        .get('/stock-write-offs/stock-item/999999')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('200 — los campos del DTO son correctos', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-write-offs/stock-item/${stockItemId}`)
        .expect(200);

      const wo = res.body[0];
      expect(wo.id).toBeDefined();
      expect(wo.stockItemId).toBe(stockItemId);
      expect(wo.movementId).toBeDefined();
      expect(wo.quantity).toBe(3);
      expect(wo.reason).toBe(StockWriteOffReason.DAMAGED);
      expect(wo.description).toBe('Cajas rotas en tránsito');
      expect(wo.reportedBy).toBe(1);
      expect(wo.createdAt).toBeDefined();
      expect(wo.updatedAt).toBeDefined();
    });
  });

  // =============================================
  // GET /stock-write-offs/:id
  // =============================================

  describe('GET /stock-write-offs/:id', () => {
    it('200 — retorna una baja por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-write-offs/${writeOffId}`)
        .expect(200);

      expect(res.body.id).toBe(writeOffId);
      expect(res.body.stockItemId).toBe(stockItemId);
      expect(res.body.quantity).toBe(3);
      expect(res.body.reason).toBe(StockWriteOffReason.DAMAGED);
      expect(res.body.description).toBe('Cajas rotas en tránsito');
    });

    it('200 — attachments es undefined cuando no se cargaron', async () => {
      const res = await request(app.getHttpServer())
        .get(`/stock-write-offs/${writeOffId}`)
        .expect(200);

      expect(res.body.attachments).toBeUndefined();
    });

    it('404 — baja no encontrada', async () => {
      await request(app.getHttpServer())
        .get('/stock-write-offs/999999')
        .expect(404);
    });
  });

  // =============================================
  // PATCH /stock-write-offs/:id
  // =============================================

  describe('PATCH /stock-write-offs/:id', () => {
    it('200 — actualiza reason y description', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/stock-write-offs/${writeOffId}`)
        .send({
          reason: StockWriteOffReason.EXPIRED,
          description: 'Producto vencido',
        })
        .expect(200);

      expect(res.body.id).toBe(writeOffId);
      expect(res.body.reason).toBe(StockWriteOffReason.EXPIRED);
      expect(res.body.description).toBe('Producto vencido');
    });

    it('200 — actualiza solo attachments (body parcial)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/stock-write-offs/${writeOffId}`)
        .send({ attachments: ['https://cdn.ejemplo.com/foto.jpg'] })
        .expect(200);

      expect(res.body.attachments).toEqual([
        'https://cdn.ejemplo.com/foto.jpg',
      ]);
    });

    it('200 — body vacío no modifica nada', async () => {
      const before = await request(app.getHttpServer())
        .get(`/stock-write-offs/${writeOffId}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/stock-write-offs/${writeOffId}`)
        .send({})
        .expect(200);

      expect(res.body.reason).toBe(before.body.reason);
      expect(res.body.description).toBe(before.body.description);
    });

    it('400 — reason con valor inválido', async () => {
      await request(app.getHttpServer())
        .patch(`/stock-write-offs/${writeOffId}`)
        .send({ reason: 'INVALID_REASON' })
        .expect(400);
    });

    it('404 — baja no encontrada', async () => {
      await request(app.getHttpServer())
        .patch('/stock-write-offs/999999')
        .send({ reason: StockWriteOffReason.LOST })
        .expect(404);
    });
  });
});
