import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { ComboImageController } from '../../src/modules/products/combo-images/controllers/combo-image.controller';
import { ComboImageService } from '../../src/modules/products/combo-images/services/combo-image.service';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

describe('ComboImages (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
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
              ComboImageEntity,
              ComboEntity,
              ComboItemEntity,
              ProductEntity,
              ProductImageEntity,
              CategoryEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([ComboImageEntity, ComboEntity]),
      ],
      controllers: [ComboImageController],
      providers: [ComboImageService],
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
      name: 'Combos',
      isActive: true,
    });
    const product = await dataSource.getRepository(ProductEntity).save({
      sku: 'CIMG-PROD-001',
      name: 'Coca Cola',
      description: 'Gaseosa',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    const combo = await dataSource.getRepository(ComboEntity).save({
      name: 'Combo Coca x3',
      description: 'Tres Cocas',
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
  // CREATE
  // -------------------------

  it('POST /combo-images → 201 con datos válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/combo-images')
      .send({ comboId, url: 'https://img.com/combo1.jpg', position: 1 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.comboId).toBe(comboId);
    expect(res.body.position).toBe(1);
  });

  it('POST /combo-images → 404 si combo no existe', async () => {
    await request(app.getHttpServer())
      .post('/combo-images')
      .send({ comboId: 999999, url: 'https://img.com/x.jpg', position: 1 })
      .expect(404);
  });

  it('POST /combo-images → 400 con datos inválidos', async () => {
    await request(app.getHttpServer())
      .post('/combo-images')
      .send({})
      .expect(400);
  });

  // -------------------------
  // GET ALL BY COMBO
  // -------------------------

  it('GET /combo-images/combo/:comboId → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/combo-images/combo/${comboId}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // -------------------------
  // GET BY ID
  // -------------------------

  it('GET /combo-images/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/combo-images')
      .send({ comboId, url: 'https://img.com/combo2.jpg', position: 2 });

    await request(app.getHttpServer())
      .get(`/combo-images/${created.body.id}`)
      .expect(200);
  });

  it('GET /combo-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/combo-images/999999').expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /combo-images/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/combo-images')
      .send({ comboId, url: 'https://img.com/combo3.jpg', position: 3 });

    const res = await request(app.getHttpServer())
      .patch(`/combo-images/${created.body.id}`)
      .send({ position: 10 })
      .expect(200);

    expect(res.body.position).toBe(10);
  });

  it('PATCH /combo-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/combo-images/999999')
      .send({ position: 1 })
      .expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /combo-images/:id → 204 y luego 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/combo-images')
      .send({ comboId, url: 'https://img.com/combo4.jpg', position: 4 });

    await request(app.getHttpServer())
      .delete(`/combo-images/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/combo-images/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /combo-images/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .delete('/combo-images/999999')
      .expect(404);
  });
});
