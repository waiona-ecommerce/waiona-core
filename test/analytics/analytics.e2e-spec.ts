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

import { AnalyticsController } from '../../src/modules/analytics/analytics.controller';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service';

import { OrderEntity } from '../../src/modules/orders/entities/order.entity';
import { OrderItemEntity } from '../../src/modules/orders/entities/order-item.entity';
import { OrderStatus } from '../../src/modules/orders/enums/order-status.enum';
import { DeliveryType } from '../../src/modules/orders/enums/delivery-type.enum';

import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockMovementEntity } from '../../src/modules/stocks/stock-movement/entities/stock-movement.entity';
import { StockWriteOffEntity } from '../../src/modules/stocks/stock-writeoff/entities/stock-writeoff.entity';
import { StockLocationType } from '../../src/modules/stocks/stock-locations/enums/stock-location-type.enum';
import { UserEntity } from '../../src/modules/users/entities/user.entity';
import { ProfileEntity } from '../../src/modules/users/entities/profile.entity';
import { RoleEntity } from '../../src/modules/users/entities/role.entity';
import { CouponEntity } from '../../src/modules/coupons/coupon/entities/coupon.entity';

const ALL_ENTITIES = [
  OrderEntity,
  OrderItemEntity,
  ProductEntity,
  ProductImageEntity,
  CategoryEntity,
  ComboEntity,
  ComboItemEntity,
  ComboImageEntity,
  StockItemEntity,
  StockLocationEntity,
  StockMovementEntity,
  StockWriteOffEntity,
  UserEntity,
  ProfileEntity,
  RoleEntity,
  CouponEntity,
];

describe('Analytics (e2e)', () => {
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
            entities: ALL_ENTITIES,
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          OrderEntity,
          OrderItemEntity,
          StockItemEntity,
        ]),
      ],
      controllers: [AnalyticsController],
      providers: [AnalyticsService],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    await seedTestData(dataSource);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─── GET /v1/analytics/orders ──────────────────────────────────────────────

  describe('GET /v1/analytics/orders', () => {
    it('returns 200 with correct shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/analytics/orders')
        .expect(200);

      expect(res.body).toMatchObject({
        total: expect.any(Number),
        byStatus: expect.objectContaining({
          pending: expect.any(Number),
          confirmed: expect.any(Number),
          dispatched: expect.any(Number),
          delivered: expect.any(Number),
          cancelled: expect.any(Number),
        }),
        totalRevenue: expect.any(Number),
        revenueToday: expect.any(Number),
        revenueThisMonth: expect.any(Number),
      });
    });

    it('counts seeded orders correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/analytics/orders')
        .expect(200);

      // seed creates 1 delivered + 1 pending + 1 cancelled
      expect(res.body.total).toBe(3);
      expect(res.body.byStatus.delivered).toBe(1);
      expect(res.body.byStatus.pending).toBe(1);
      expect(res.body.byStatus.cancelled).toBe(1);
      expect(res.body.totalRevenue).toBeGreaterThan(0);
    });
  });

  // ─── GET /v1/analytics/products/top ────────────────────────────────────────

  describe('GET /v1/analytics/products/top', () => {
    it('returns 200 with array of top products', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/analytics/products/top')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('only includes products from delivered orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/analytics/products/top')
        .expect(200);

      // seed: 1 delivered order with 2 units of product A
      // pending order items should NOT appear
      expect(res.body.length).toBeGreaterThan(0);
      const entry = res.body[0];
      expect(entry).toMatchObject({
        productId: expect.any(Number),
        name: expect.any(String),
        sku: expect.any(String),
        totalSold: expect.any(Number),
      });
      expect(entry.totalSold).toBeGreaterThan(0);
    });
  });

  // ─── GET /v1/analytics/stock/critical ──────────────────────────────────────

  describe('GET /v1/analytics/stock/critical', () => {
    it('returns 200 with array', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/analytics/stock/critical')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('includes stock items at or below critical threshold', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/analytics/stock/critical')
        .expect(200);

      // seed creates 1 critical stock item (current=2, critical=5)
      expect(res.body.length).toBeGreaterThan(0);
      const item = res.body[0];
      expect(item).toMatchObject({
        id: expect.any(Number),
        productId: expect.any(Number),
        productName: expect.any(String),
        sku: expect.any(String),
        locationId: expect.any(Number),
        locationName: expect.any(String),
        quantityCurrent: expect.any(Number),
        quantityReserved: expect.any(Number),
        quantityAvailable: expect.any(Number),
        stockCritical: expect.any(Number),
        stockMin: expect.any(Number),
      });
      expect(item.quantityCurrent).toBeLessThanOrEqual(item.stockCritical);
    });
  });
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedTestData(ds: DataSource): Promise<void> {
  const categoryRepo = ds.getRepository(CategoryEntity);
  const productRepo = ds.getRepository(ProductEntity);
  const locationRepo = ds.getRepository(StockLocationEntity);
  const stockItemRepo = ds.getRepository(StockItemEntity);
  const orderRepo = ds.getRepository(OrderEntity);
  const orderItemRepo = ds.getRepository(OrderItemEntity);
  const profileRepo = ds.getRepository(ProfileEntity);
  const userRepo = ds.getRepository(UserEntity);

  const profile = await profileRepo.save(
    profileRepo.create({ name: 'Test', lastName: 'User' }),
  );
  const user = await userRepo.save(
    userRepo.create({
      email: 'test@analytics.com',
      password: 'Password1!',
      isActive: true,
      profileId: profile.id,
    }),
  );

  const category = await categoryRepo.save(
    categoryRepo.create({ name: 'Test Category' }),
  );

  const productA = await productRepo.save(
    productRepo.create({
      name: 'Producto A',
      sku: 'PROD-A',
      description: 'Test',
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
      isActive: true,
    }),
  );

  const productB = await productRepo.save(
    productRepo.create({
      name: 'Producto B',
      sku: 'PROD-B',
      description: 'Test',
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
      isActive: true,
    }),
  );

  const location = await locationRepo.save(
    locationRepo.create({
      name: 'Depósito Test',
      type: StockLocationType.WAREHOUSE,
    }),
  );

  // stock item OK (above critical)
  await stockItemRepo.save(
    stockItemRepo.create({
      productId: productA.id,
      locationId: location.id,
      quantityCurrent: 50,
      quantityReserved: 0,
      stockMin: 10,
      stockCritical: 5,
    }),
  );

  // stock item CRITICAL (at or below threshold)
  await stockItemRepo.save(
    stockItemRepo.create({
      productId: productB.id,
      locationId: location.id,
      quantityCurrent: 2,
      quantityReserved: 0,
      stockMin: 10,
      stockCritical: 5,
    }),
  );

  const makeOrder = (status: OrderStatus, total: number) =>
    orderRepo.create({
      userId: user.id,
      status,
      deliveryType: DeliveryType.PICKUP,
      subtotal: total,
      total,
    });

  const deliveredOrder = await orderRepo.save(
    makeOrder(OrderStatus.DELIVERED, 1500),
  );
  await orderRepo.save(makeOrder(OrderStatus.PENDING, 800));
  await orderRepo.save(makeOrder(OrderStatus.CANCELLED, 500));

  await orderItemRepo.save(
    orderItemRepo.create({
      orderId: deliveredOrder.id,
      productId: productA.id,
      quantity: 2,
      unitPrice: 750,
      finalPrice: 750,
    }),
  );
}
