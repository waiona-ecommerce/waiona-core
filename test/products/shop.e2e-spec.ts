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

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ShopController } from '../../src/modules/products/shop/controllers/shop.controller';
import { ShopService } from '../../src/modules/products/shop/services/shop.service';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { CalculationService } from '../../src/modules/pricing/calculation/services/calculation.service';
import { StockItemsService } from '../../src/modules/stocks/stock-item/services/stock-item.service';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

// CalculationService y StockItemsService tienen cadenas de dependencias complejas.
// Se mockean con respuestas realistas. Los casos de error internos (sin pricing) están
// cubiertos por los unit tests del ShopService.
const mockCalculation = {
  calculateProduct: jest.fn().mockResolvedValue({
    unitPrice: 500,
    discount: 50,
    priceAfterDiscount: 450,
    margin: 90,
    priceAfterMargin: 540,
    taxes: 113.4,
    finalPrice: 653.4,
    fullPrice: 726,
    coupon: 0,
    orderTotal: 653.4,
  }),
  calculateCombo: jest.fn().mockResolvedValue({
    unitPrice: 1200,
    discount: 0,
    priceAfterDiscount: 1200,
    margin: 240,
    priceAfterMargin: 1440,
    taxes: 302.4,
    finalPrice: 1742.4,
    fullPrice: 1742.4,
    coupon: 0,
    orderTotal: 1742.4,
  }),
};

const mockStock = {
  findByProduct: jest.fn().mockResolvedValue({
    quantityAvailable: 10,
    stockMin: 5,
    stockCritical: 2,
  }),
  findByCombo: jest
    .fn()
    .mockResolvedValue({ quantityAvailable: 5, inStock: true }),
};

describe('Shop (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productId: number;
  let comboId: number;

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
              ProductEntity,
              ProductImageEntity,
              ComboEntity,
              ComboItemEntity,
              ComboImageEntity,
              CategoryEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([ProductEntity, ComboEntity, CategoryEntity]),
      ],
      controllers: [ShopController],
      providers: [
        ShopService,
        { provide: CalculationService, useValue: mockCalculation },
        { provide: StockItemsService, useValue: mockStock },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();

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

    const category = await dataSource.getRepository(CategoryEntity).save({
      name: 'Bebidas',
      isActive: true,
    });
    const product = await dataSource.getRepository(ProductEntity).save({
      sku: 'SHOP-001',
      name: 'Coca Cola 500ml',
      description: 'Gaseosa negra',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    productId = product.id;

    const combo = await dataSource.getRepository(ComboEntity).save({
      name: 'Combo Coca x3',
      description: 'Tres Cocas 500ml',
      isActive: true,
      categoryId: category.id,
    });
    await dataSource.getRepository(ComboItemEntity).save({
      comboId: combo.id,
      productId: product.id,
      quantity: 3,
    });
    comboId = combo.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // SEARCH
  // -------------------------

  it('GET /shop/items → 200 con resultados paginados', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/shop/items')
      .expect(200);

    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.data).toBeDefined();
    expect(res.body.page).toBe(1);
    expect(res.body.hasNextPage).toBeDefined();
  });

  it('GET /shop/items?type=product → solo productos', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/shop/items?type=product')
      .expect(200);

    expect(res.body.data.every((i: any) => i.type === 'product')).toBe(true);
  });

  it('GET /shop/items?type=combo → solo combos', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/shop/items?type=combo')
      .expect(200);

    expect(res.body.data.every((i: any) => i.type === 'combo')).toBe(true);
  });

  it('GET /shop/items?search=coca → filtra por nombre', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/shop/items?search=coca')
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /shop/items?minPrice=999999 → sin resultados', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/shop/items?minPrice=999999')
      .expect(200);

    expect(res.body.data).toHaveLength(0);
  });

  it('GET /shop/items?minPrice=100&maxPrice=50 → 400 rango inválido', async () => {
    await request(app.getHttpServer())
      .get('/v1/shop/items?minPrice=100&maxPrice=50')
      .expect(400);
  });

  // -------------------------
  // FIND BY ID
  // -------------------------

  it('GET /shop/items/:id?type=product → 200 detalle producto', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/shop/items/${productId}?type=product`)
      .expect(200);

    expect(res.body.type).toBe('product');
    expect(res.body.finalPrice).toBeDefined();
    expect(res.body.stockStatus).toBeDefined();
    expect(res.body.images).toBeDefined();
  });

  it('GET /shop/items/:id?type=combo → 200 detalle combo con items', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/shop/items/${comboId}?type=combo`)
      .expect(200);

    expect(res.body.type).toBe('combo');
    expect(res.body.items).toBeDefined();
  });

  it('GET /shop/items/:id → 400 sin type', async () => {
    await request(app.getHttpServer())
      .get(`/v1/shop/items/${productId}`)
      .expect(400);
  });

  it('GET /shop/items/999999?type=product → 404', async () => {
    await request(app.getHttpServer())
      .get('/v1/shop/items/999999?type=product')
      .expect(404);
  });
});
