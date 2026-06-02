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

import { ProductController } from '../../src/modules/products/product/controllers/product.controller';
import { ProductService } from '../../src/modules/products/product/services/product.service';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';

describe('Product (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let categoryId: number;

  const validProduct = () => ({
    sku: `SKU-${Date.now()}`,
    name: 'Coca Cola 500ml',
    description: 'Gaseosa negra 500ml',
    measurementUnit: 'unit',
    categoryId,
  });

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
        TypeOrmModule.forFeature([ProductEntity, CategoryEntity]),
      ],
      controllers: [ProductController],
      providers: [ProductService],
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

    const category = await dataSource.getRepository(CategoryEntity).save({
      name: 'Bebidas',
      isActive: true,
    });
    categoryId = category.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /products → 201 con datos válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/products')
      .send(validProduct())
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('COCA COLA 500ML');
    expect(res.body.categoryId).toBe(categoryId);
  });

  it('POST /products → 409 cuando SKU ya existe', async () => {
    const dto = validProduct();
    await request(app.getHttpServer())
      .post('/v1/products')
      .send(dto)
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/products')
      .send(dto)
      .expect(409);
  });

  it('POST /products → 400 con datos inválidos', async () => {
    await request(app.getHttpServer())
      .post('/v1/products')
      .send({ name: 'X' })
      .expect(400);
  });

  it('POST /products → 400 con categoryId inválida', async () => {
    await request(app.getHttpServer())
      .post('/v1/products')
      .send({ ...validProduct(), categoryId: 999999 })
      .expect(400);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /products → 200 paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/products')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  // -------------------------
  // GET BY ID
  // -------------------------

  it('GET /products/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/products')
      .send(validProduct());

    const res = await request(app.getHttpServer())
      .get(`/v1/products/${created.body.id}`)
      .expect(200);

    expect(res.body.id).toBe(created.body.id);
  });

  it('GET /products/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/v1/products/999999').expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /products/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/products')
      .send(validProduct());

    const res = await request(app.getHttpServer())
      .patch(`/v1/products/${created.body.id}`)
      .send({ name: 'Coca Cola 1L', isActive: false })
      .expect(200);

    expect(res.body.name).toBe('COCA COLA 1L');
    expect(res.body.isActive).toBe(false);
  });

  it('PATCH /products/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/v1/products/999999')
      .send({ name: 'Actualizado' })
      .expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /products/:id → 204 y luego 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/products')
      .send(validProduct());

    await request(app.getHttpServer())
      .delete(`/v1/products/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/products/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /products/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .delete('/v1/products/999999')
      .expect(404);
  });
});
