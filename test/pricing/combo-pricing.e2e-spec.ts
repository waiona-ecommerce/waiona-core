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

import { ComboPricingController } from '../../src/modules/pricing/controllers/combo-pricing.controller';
import { ComboPricingService } from '../../src/modules/pricing/services/combo-pricing.service';
import { ComboPricingEntity } from '../../src/modules/pricing/entities/combo-pricing.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { CurrencyCode } from '../../src/common/enums/currency-code.enum';

describe('ComboPricing (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let comboId: number;
  let combo2Id: number;

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
              ComboPricingEntity,
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
        TypeOrmModule.forFeature([ComboPricingEntity]),
      ],
      controllers: [ComboPricingController],
      providers: [ComboPricingService],
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

    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Test Category',
      isActive: true,
    });

    const combo = await dataSource.manager.save(ComboEntity, {
      name: 'Test Combo',
      description: 'Test description',
      isActive: true,
      categoryId: category.id,
    });
    comboId = combo.id;

    const combo2 = await dataSource.manager.save(ComboEntity, {
      name: 'Test Combo 2',
      description: 'Test description 2',
      isActive: true,
      categoryId: category.id,
    });
    combo2Id = combo2.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // -------------------------
  // CREATE
  // -------------------------

  it('POST /combo-pricing -> 201 crea el pricing', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/combo-pricing')
      .send({
        comboId,
        currency: CurrencyCode.ARS,
        unitPrice: 1200,
        salePrice: 1500,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.comboId).toBe(comboId);
    expect(res.body.unitPrice).toBe(1200);
    expect(res.body.salePrice).toBe(1500);
  });

  it('POST /combo-pricing -> 400 si salePrice no es mayor a unitPrice', async () => {
    await request(app.getHttpServer())
      .post('/v1/combo-pricing')
      .send({
        comboId: combo2Id,
        currency: CurrencyCode.ARS,
        unitPrice: 1500,
        salePrice: 1500,
      })
      .expect(400);
  });

  it('POST /combo-pricing -> 201 con salePrice mayor a unitPrice', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/combo-pricing')
      .send({
        comboId: combo2Id,
        currency: CurrencyCode.ARS,
        unitPrice: 1500,
        salePrice: 1900,
      })
      .expect(201);

    expect(res.body.unitPrice).toBe(1500);
    expect(res.body.salePrice).toBe(1900);
  });

  it('POST /combo-pricing -> 409 si el combo ya tiene pricing', async () => {
    await request(app.getHttpServer())
      .post('/v1/combo-pricing')
      .send({
        comboId,
        currency: CurrencyCode.ARS,
        unitPrice: 1300,
        salePrice: 1600,
      })
      .expect(409);
  });

  it('POST /combo-pricing -> 400 si faltan campos', async () => {
    await request(app.getHttpServer())
      .post('/v1/combo-pricing')
      .send({})
      .expect(400);
  });

  // -------------------------
  // GET ALL
  // -------------------------

  it('GET /combo-pricing -> 200 paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/combo-pricing')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
  });

  it('GET /combo-pricing?page=1&limit=1 -> respeta paginación', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/combo-pricing?page=1&limit=1')
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });

  // -------------------------
  // GET ONE
  // -------------------------

  it('GET /combo-pricing/:id -> 200 retorna el pricing', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/v1/combo-pricing')
      .expect(200);

    const id = listRes.body.data[0].id;
    const res = await request(app.getHttpServer())
      .get(`/v1/combo-pricing/${id}`)
      .expect(200);

    expect(res.body.id).toBe(id);
  });

  it('GET /combo-pricing/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .get('/v1/combo-pricing/999999')
      .expect(404);
  });

  // -------------------------
  // GET BY COMBO
  // -------------------------

  it('GET /combo-pricing/combo/:comboId -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/combo-pricing/combo/${comboId}`)
      .expect(200);

    expect(res.body.comboId).toBe(comboId);
  });

  it('GET /combo-pricing/combo/:comboId -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .get('/v1/combo-pricing/combo/999999')
      .expect(404);
  });

  // -------------------------
  // UPDATE
  // -------------------------

  it('PATCH /combo-pricing/:id -> 200 actualiza precio', async () => {
    const listRes = await request(app.getHttpServer()).get('/v1/combo-pricing');
    const id = listRes.body.data[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/v1/combo-pricing/${id}`)
      .send({ unitPrice: 1250 })
      .expect(200);

    expect(res.body.unitPrice).toBe(1250);
  });

  it('PATCH /combo-pricing/:id -> 400 si salePrice queda menor o igual a unitPrice', async () => {
    const listRes = await request(app.getHttpServer()).get('/v1/combo-pricing');
    const id = listRes.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/v1/combo-pricing/${id}`)
      .send({ salePrice: 100 })
      .expect(400);
  });

  it('PATCH /combo-pricing/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .patch('/v1/combo-pricing/999999')
      .send({ unitPrice: 100 })
      .expect(404);
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /combo-pricing/:id -> 204 y luego 404', async () => {
    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Cat Delete',
      isActive: true,
    });
    const toDelete = await dataSource.manager.save(ComboEntity, {
      name: 'Delete Combo',
      description: 'desc',
      isActive: true,
      categoryId: category.id,
    });

    const createRes = await request(app.getHttpServer())
      .post('/v1/combo-pricing')
      .send({
        comboId: toDelete.id,
        currency: CurrencyCode.ARS,
        unitPrice: 100,
        salePrice: 150,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/combo-pricing/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/combo-pricing/${createRes.body.id}`)
      .expect(404);
  });

  it('DELETE /combo-pricing/:id -> 404 si no existe', async () => {
    await request(app.getHttpServer())
      .delete('/v1/combo-pricing/999999')
      .expect(404);
  });
});
