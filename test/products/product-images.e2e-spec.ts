import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { ProductImageController } from '../../src/modules/products/product-images/controllers/product-image.controller';
import { ProductImageService } from '../../src/modules/products/product-images/services/product-image.service';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

describe('ProductImages (e2e)', () => {
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
              ProductImageEntity,
              ProductEntity,
              ComboEntity,
              ComboItemEntity,
              ComboImageEntity,
              CategoryEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([ProductImageEntity, ProductEntity]),
      ],
      controllers: [ProductImageController],
      providers: [ProductImageService],
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

    const category = await dataSource.getRepository(CategoryEntity).save({
      name: 'Bebidas',
      isActive: true,
    });
    const product = await dataSource.getRepository(ProductEntity).save({
      sku: 'IMG-TEST-001',
      name: 'Coca Cola',
      description: 'Gaseosa 500ml',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    productId = product.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /product-images → 201 con datos válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/product-images')
      .send({ productId, url: 'https://img.com/coca1.jpg', position: 1 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.productId).toBe(productId);
    expect(res.body.position).toBe(1);
  });

  it('POST /product-images → 404 si producto no existe', async () => {
    await request(app.getHttpServer())
      .post('/product-images')
      .send({ productId: 999999, url: 'https://img.com/x.jpg', position: 1 })
      .expect(404);
  });

  it('POST /product-images → 400 con datos inválidos', async () => {
    await request(app.getHttpServer())
      .post('/product-images')
      .send({})
      .expect(400);
  });

  // -------------------------
  // GET ALL BY PRODUCT
  // -------------------------

  it('GET /product-images/product/:productId → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/product-images/product/${productId}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // -------------------------
  // GET BY ID
  // -------------------------

  it('GET /product-images/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/product-images')
      .send({ productId, url: 'https://img.com/coca2.jpg', position: 2 });

    await request(app.getHttpServer())
      .get(`/product-images/${created.body.id}`)
      .expect(200);
  });

  it('GET /product-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .get('/product-images/999999')
      .expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /product-images/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/product-images')
      .send({ productId, url: 'https://img.com/coca3.jpg', position: 3 });

    const res = await request(app.getHttpServer())
      .patch(`/product-images/${created.body.id}`)
      .send({ position: 10 })
      .expect(200);

    expect(res.body.position).toBe(10);
  });

  it('PATCH /product-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/product-images/999999')
      .send({ position: 1 })
      .expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /product-images/:id → 204 y luego 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/product-images')
      .send({ productId, url: 'https://img.com/coca4.jpg', position: 4 });

    await request(app.getHttpServer())
      .delete(`/product-images/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/product-images/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /product-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .delete('/product-images/999999')
      .expect(404);
  });
});
