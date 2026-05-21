import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { ProductTaxesController } from '../../src/modules/taxation/product-taxes/controllers/product-taxes.controller';
import { ProductTaxesService } from '../../src/modules/taxation/product-taxes/services/product-taxes.service';
import { ProductTaxEntity } from '../../src/modules/taxation/product-taxes/entities/product-taxes.entity';
import { TaxEntity } from '../../src/modules/taxation/taxes/entities/tax.entity';
import { TaxTypeEntity } from '../../src/modules/taxation/tax-types/entities/tax-types.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

describe('ProductTaxes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productId: number;
  let taxId: number;
  let globalTaxId: number;

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
              ProductTaxEntity,
              TaxEntity,
              TaxTypeEntity,
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
        TypeOrmModule.forFeature([ProductTaxEntity, TaxEntity]),
      ],
      controllers: [ProductTaxesController],
      providers: [ProductTaxesService],
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

    const taxType = await dataSource.manager.save(TaxTypeEntity, {
      code: 'IVA',
      name: 'IVA Test',
    });

    const tax = await dataSource.manager.save(TaxEntity, {
      taxTypeId: taxType.id,
      value: 21,
      isPercentage: true,
      isGlobal: false,
    });
    taxId = tax.id;

    const globalTax = await dataSource.manager.save(TaxEntity, {
      taxTypeId: taxType.id,
      value: 5,
      isPercentage: true,
      isGlobal: true,
    });
    globalTaxId = globalTax.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /products/:productId/taxes -> should assign tax to product', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${productId}/taxes`)
      .send({ taxId })
      .expect(201);

    expect(res.body.productId).toBe(productId);
    expect(res.body.taxId).toBe(taxId);
    expect(res.body.id).toBeDefined();
  });

  it('POST /products/:productId/taxes -> should fail if tax not found', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/taxes`)
      .send({ taxId: 999999 })
      .expect(404);
  });

  it('POST /products/:productId/taxes -> should fail if tax is global', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/taxes`)
      .send({ taxId: globalTaxId })
      .expect(400);
  });

  it('POST /products/:productId/taxes -> should fail validation if taxId missing', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/taxes`)
      .send({})
      .expect(400);
  });

  // -------------------------
  // FIND ALL
  // -------------------------

  it('GET /products/:productId/taxes -> should return array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${productId}/taxes`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /products/:productId/taxes -> should return empty array for product with no taxes', async () => {
    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Another Category',
      isActive: true,
    });

    const product2 = await dataSource.manager.save(ProductEntity, {
      sku: 'TEST-002',
      name: 'Test Product 2',
      description: 'Test description',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });

    const res = await request(app.getHttpServer())
      .get(`/products/${product2.id}/taxes`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  // -------------------------
  // FIND ONE
  // -------------------------

  it('GET /products/:productId/taxes/:id -> should return one', async () => {
    const taxType2 = await dataSource.manager.save(TaxTypeEntity, {
      code: 'IIBB',
      name: 'Ingresos Brutos',
    });

    const tax2 = await dataSource.manager.save(TaxEntity, {
      taxTypeId: taxType2.id,
      value: 3,
      isPercentage: true,
      isGlobal: false,
    });

    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Category FindOne',
      isActive: true,
    });

    const product3 = await dataSource.manager.save(ProductEntity, {
      sku: 'TEST-003',
      name: 'Test Product 3',
      description: 'Test description',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });

    const createRes = await request(app.getHttpServer())
      .post(`/products/${product3.id}/taxes`)
      .send({ taxId: tax2.id });

    const res = await request(app.getHttpServer())
      .get(`/products/${product3.id}/taxes/${createRes.body.id}`)
      .expect(200);

    expect(res.body.taxId).toBe(tax2.id);
  });

  it('GET /products/:productId/taxes/:id -> should return 404', async () => {
    await request(app.getHttpServer())
      .get(`/products/${productId}/taxes/999999`)
      .expect(404);
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /products/:productId/taxes/:id -> should soft delete', async () => {
    const taxType3 = await dataSource.manager.save(TaxTypeEntity, {
      code: 'TST',
      name: 'Test Tax Type',
    });

    const tax3 = await dataSource.manager.save(TaxEntity, {
      taxTypeId: taxType3.id,
      value: 10,
      isPercentage: true,
      isGlobal: false,
    });

    const createRes = await request(app.getHttpServer())
      .post(`/products/${productId}/taxes`)
      .send({ taxId: tax3.id });

    await request(app.getHttpServer())
      .delete(`/products/${productId}/taxes/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/products/${productId}/taxes/${createRes.body.id}`)
      .expect(404);
  });

  it('DELETE /products/:productId/taxes/:id -> should return 404 if not found', async () => {
    await request(app.getHttpServer())
      .delete(`/products/${productId}/taxes/999999`)
      .expect(404);
  });
});
