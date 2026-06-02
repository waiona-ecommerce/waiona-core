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

import { ComboController } from '../../src/modules/products/combos/controllers/combo.controller';
import { ComboService } from '../../src/modules/products/combos/services/combo.service';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

describe('Combos (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let categoryId: number;
  let productId: number;

  const validCombo = () => ({
    name: `Combo Test ${Date.now()}`,
    description: 'Combo de prueba e2e',
    categoryId,
    items: [{ productId, quantity: 2 }],
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
              ComboEntity,
              ComboItemEntity,
              ComboImageEntity,
              ProductEntity,
              ProductImageEntity,
              CategoryEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          ComboEntity,
          ComboItemEntity,
          ProductEntity,
          CategoryEntity,
        ]),
      ],
      controllers: [ComboController],
      providers: [ComboService],
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
      name: 'Combos',
      isActive: true,
    });
    categoryId = category.id;

    const product = await dataSource.getRepository(ProductEntity).save({
      sku: 'COMBO-PROD-001',
      name: 'Coca Cola 500ml',
      description: 'Gaseosa',
      isActive: true,
      categoryId,
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

  it('POST /combos → 201 con datos válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/combos')
      .send(validCombo())
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].productId).toBe(productId);
    expect(res.body.categoryId).toBe(categoryId);
  });

  it('POST /combos → 400 con categoría inválida', async () => {
    await request(app.getHttpServer())
      .post('/v1/combos')
      .send({ ...validCombo(), categoryId: 999999 })
      .expect(400);
  });

  it('POST /combos → 400 con producto inválido en items', async () => {
    await request(app.getHttpServer())
      .post('/v1/combos')
      .send({ ...validCombo(), items: [{ productId: 999999, quantity: 1 }] })
      .expect(400);
  });

  it('POST /combos → 400 con items duplicados', async () => {
    await request(app.getHttpServer())
      .post('/v1/combos')
      .send({
        ...validCombo(),
        items: [
          { productId, quantity: 1 },
          { productId, quantity: 2 },
        ],
      })
      .expect(400);
  });

  it('POST /combos → 400 sin items', async () => {
    await request(app.getHttpServer())
      .post('/v1/combos')
      .send({
        name: 'Sin items',
        description: 'Sin items',
        categoryId,
        items: [],
      })
      .expect(400);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /combos → 200 paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/combos')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.total).toBeGreaterThan(0);
  });

  // -------------------------
  // GET BY ID
  // -------------------------

  it('GET /combos/:id → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/combos')
      .send(validCombo());

    const res = await request(app.getHttpServer())
      .get(`/v1/combos/${created.body.id}`)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
  });

  it('GET /combos/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/v1/combos/999999').expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /combos/:id → 200 actualiza nombre', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/combos')
      .send(validCombo());

    const res = await request(app.getHttpServer())
      .patch(`/v1/combos/${created.body.id}`)
      .send({ name: 'Combo Actualizado' })
      .expect(200);

    expect(res.body.name).toBe('COMBO ACTUALIZADO');
  });

  it('PATCH /combos/:id → 200 reemplaza items', async () => {
    const product2 = await dataSource.getRepository(ProductEntity).save({
      sku: `COMBO-PROD-${Date.now()}`,
      name: 'Sprite',
      description: 'Gaseosa verde',
      isActive: true,
      categoryId,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });

    const created = await request(app.getHttpServer())
      .post('/v1/combos')
      .send(validCombo());

    const res = await request(app.getHttpServer())
      .patch(`/v1/combos/${created.body.id}`)
      .send({ items: [{ productId: product2.id, quantity: 3 }] })
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].productId).toBe(product2.id);
  });

  it('PATCH /combos/:id → 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/v1/combos/999999')
      .send({ name: 'Actualizado' })
      .expect(404);
  });

  // -------------------------
  // DELETE (soft)
  // -------------------------

  it('DELETE /combos/:id → 204 y luego 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/combos')
      .send(validCombo());

    await request(app.getHttpServer())
      .delete(`/v1/combos/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/combos/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /combos/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).delete('/v1/combos/999999').expect(404);
  });
});
