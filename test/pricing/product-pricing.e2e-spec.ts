import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { ProductPricingController } from '../../src/modules/pricing/controllers/product-pricing.controller';
import { ProductPricingService } from '../../src/modules/pricing/services/product-pricing.service';
import { ProductPricingEntity } from '../../src/modules/pricing/entities/product-pricing.entity';
import { MarginEntity } from '../../src/modules/margins/entities/margin.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';
import { CurrencyCode } from '../../src/common/enums/currency-code.enum';

describe('ProductPricing (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productId: number;
  let product2Id: number;
  let marginId: number;

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
              ProductPricingEntity,
              MarginEntity,
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
        TypeOrmModule.forFeature([ProductPricingEntity, MarginEntity]),
      ],
      controllers: [ProductPricingController],
      providers: [ProductPricingService],
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

    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Test Category',
      isActive: true,
    });

    const product = await dataSource.manager.save(ProductEntity, {
      sku: 'TEST-001',
      name: 'Test Product',
      description: 'Test description',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    productId = product.id;

    const product2 = await dataSource.manager.save(ProductEntity, {
      sku: 'TEST-002',
      name: 'Test Product 2',
      description: 'Test description 2',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    product2Id = product2.id;

    const margin = await dataSource.manager.save(MarginEntity, {
      name: 'Test Margin',
      value: 20,
      isPercentage: true,
    });
    marginId = margin.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /product-pricing -> 201 sin margen', async () => {
    const res = await request(app.getHttpServer())
      .post('/product-pricing')
      .send({ productId, currency: CurrencyCode.ARS, unitPrice: 500 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.productId).toBe(productId);
    expect(res.body.unitPrice).toBe(500);
    expect(res.body.marginId).toBeNull();
  });

  it('POST /product-pricing -> 201 con margen', async () => {
    const res = await request(app.getHttpServer())
      .post('/product-pricing')
      .send({
        productId: product2Id,
        currency: CurrencyCode.ARS,
        unitPrice: 800,
        marginId,
      })
      .expect(201);

    expect(res.body.marginId).toBe(marginId);
  });

  it('POST /product-pricing -> 400 si el producto ya tiene pricing', async () => {
    await request(app.getHttpServer())
      .post('/product-pricing')
      .send({ productId, currency: CurrencyCode.ARS, unitPrice: 600 })
      .expect(400);
  });

  it('POST /product-pricing -> 400 si faltan campos', async () => {
    await request(app.getHttpServer())
      .post('/product-pricing')
      .send({})
      .expect(400);
  });

  it('POST /product-pricing -> 404 si el margen no existe', async () => {
    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Cat Extra',
      isActive: true,
    });
    const extra = await dataSource.manager.save(ProductEntity, {
      sku: 'EXTRA-001',
      name: 'Extra Product',
      description: 'desc',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });

    await request(app.getHttpServer())
      .post('/product-pricing')
      .send({
        productId: extra.id,
        currency: CurrencyCode.ARS,
        unitPrice: 500,
        marginId: 999999,
      })
      .expect(404);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /product-pricing -> 200 paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/product-pricing')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
  });

  it('GET /product-pricing?page=1&limit=1 -> respeta paginación', async () => {
    const res = await request(app.getHttpServer())
      .get('/product-pricing?page=1&limit=1')
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });

  // -------------------------
  // GET ONE
  // -------------------------

  it('GET /product-pricing/:id -> 200 retorna el pricing', async () => {
    const createRes = await request(app.getHttpServer())
      .get('/product-pricing')
      .expect(200);

    const id = createRes.body.data[0].id;
    const res = await request(app.getHttpServer())
      .get(`/product-pricing/${id}`)
      .expect(200);

    expect(res.body.id).toBe(id);
  });

  it('GET /product-pricing/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .get('/product-pricing/999999')
      .expect(404);
  });

  // -------------------------
  // GET BY PRODUCT
  // -------------------------

  it('GET /product-pricing/product/:productId -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/product-pricing/product/${productId}`)
      .expect(200);

    expect(res.body.productId).toBe(productId);
  });

  it('GET /product-pricing/product/:productId -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .get('/product-pricing/product/999999')
      .expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /product-pricing/:id -> 200 actualiza precio', async () => {
    const listRes = await request(app.getHttpServer()).get('/product-pricing');
    const id = listRes.body.data[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/product-pricing/${id}`)
      .send({ unitPrice: 750 })
      .expect(200);

    expect(res.body.unitPrice).toBe(750);
  });

  it('PATCH /product-pricing/:id -> 200 asigna margen', async () => {
    const listRes = await request(app.getHttpServer()).get('/product-pricing');
    const item = listRes.body.data.find((p: any) => p.marginId === null);

    const res = await request(app.getHttpServer())
      .patch(`/product-pricing/${item.id}`)
      .send({ marginId })
      .expect(200);

    expect(res.body.marginId).toBe(marginId);
  });

  it('PATCH /product-pricing/:id -> 200 desvincula margen con null', async () => {
    const listRes = await request(app.getHttpServer()).get('/product-pricing');
    const item = listRes.body.data.find((p: any) => p.marginId !== null);

    const res = await request(app.getHttpServer())
      .patch(`/product-pricing/${item.id}`)
      .send({ marginId: null })
      .expect(200);

    expect(res.body.marginId).toBeNull();
  });

  it('PATCH /product-pricing/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/product-pricing/999999')
      .send({ unitPrice: 100 })
      .expect(404);
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /product-pricing/:id -> 204 y luego 404', async () => {
    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Cat Delete',
      isActive: true,
    });
    const toDelete = await dataSource.manager.save(ProductEntity, {
      sku: 'DEL-001',
      name: 'Delete Product',
      description: 'desc',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });

    const createRes = await request(app.getHttpServer())
      .post('/product-pricing')
      .send({
        productId: toDelete.id,
        currency: CurrencyCode.ARS,
        unitPrice: 100,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/product-pricing/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/product-pricing/${createRes.body.id}`)
      .expect(404);
  });

  it('DELETE /product-pricing/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .delete('/product-pricing/999999')
      .expect(404);
  });
});
