import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { ComboTaxesController } from '../../src/modules/taxation/combo-taxes/controllers/combo-taxes.controller';
import { ComboTaxesService } from '../../src/modules/taxation/combo-taxes/services/combo-taxes.service';
import { ComboTaxEntity } from '../../src/modules/taxation/combo-taxes/entities/combo-taxes.entity';
import { TaxEntity } from '../../src/modules/taxation/taxes/entities/tax.entity';
import { TaxTypeEntity } from '../../src/modules/taxation/tax-types/entities/tax-types.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';

describe('ComboTaxes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let comboId: number;
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
              ComboTaxEntity,
              TaxEntity,
              TaxTypeEntity,
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
        TypeOrmModule.forFeature([ComboTaxEntity, TaxEntity]),
      ],
      controllers: [ComboTaxesController],
      providers: [ComboTaxesService],
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

    const combo = await dataSource.manager.save(ComboEntity, {
      name: 'Test Combo',
      description: 'Test combo description',
      isActive: true,
      categoryId: category.id,
    });
    comboId = combo.id;

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

  it('POST /combos/:comboId/taxes -> should assign tax to combo', async () => {
    const res = await request(app.getHttpServer())
      .post(`/combos/${comboId}/taxes`)
      .send({ taxId })
      .expect(201);

    expect(res.body.comboId).toBe(comboId);
    expect(res.body.taxId).toBe(taxId);
    expect(res.body.id).toBeDefined();
  });

  it('POST /combos/:comboId/taxes -> should fail if tax not found', async () => {
    await request(app.getHttpServer())
      .post(`/combos/${comboId}/taxes`)
      .send({ taxId: 999999 })
      .expect(404);
  });

  it('POST /combos/:comboId/taxes -> should fail if tax is global', async () => {
    await request(app.getHttpServer())
      .post(`/combos/${comboId}/taxes`)
      .send({ taxId: globalTaxId })
      .expect(400);
  });

  it('POST /combos/:comboId/taxes -> should fail validation if taxId missing', async () => {
    await request(app.getHttpServer())
      .post(`/combos/${comboId}/taxes`)
      .send({})
      .expect(400);
  });

  // -------------------------
  // FIND ALL
  // -------------------------

  it('GET /combos/:comboId/taxes -> should return array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/combos/${comboId}/taxes`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /combos/:comboId/taxes -> should return empty array for combo with no taxes', async () => {
    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Another Category',
      isActive: true,
    });

    const combo2 = await dataSource.manager.save(ComboEntity, {
      name: 'Combo 2',
      description: 'Another combo',
      isActive: true,
      categoryId: category.id,
    });

    const res = await request(app.getHttpServer())
      .get(`/combos/${combo2.id}/taxes`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  // -------------------------
  // FIND ONE
  // -------------------------

  it('GET /combos/:comboId/taxes/:id -> should return one', async () => {
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

    const combo3 = await dataSource.manager.save(ComboEntity, {
      name: 'Combo FindOne',
      description: 'Test combo',
      isActive: true,
      categoryId: category.id,
    });

    const createRes = await request(app.getHttpServer())
      .post(`/combos/${combo3.id}/taxes`)
      .send({ taxId: tax2.id });

    const res = await request(app.getHttpServer())
      .get(`/combos/${combo3.id}/taxes/${createRes.body.id}`)
      .expect(200);

    expect(res.body.taxId).toBe(tax2.id);
  });

  it('GET /combos/:comboId/taxes/:id -> should return 404', async () => {
    await request(app.getHttpServer())
      .get(`/combos/${comboId}/taxes/999999`)
      .expect(404);
  });

  // -------------------------
  // DELETE
  // -------------------------

  it('DELETE /combos/:comboId/taxes/:id -> should soft delete', async () => {
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
      .post(`/combos/${comboId}/taxes`)
      .send({ taxId: tax3.id });

    await request(app.getHttpServer())
      .delete(`/combos/${comboId}/taxes/${createRes.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/combos/${comboId}/taxes/${createRes.body.id}`)
      .expect(404);
  });

  it('DELETE /combos/:comboId/taxes/:id -> should return 404 if not found', async () => {
    await request(app.getHttpServer())
      .delete(`/combos/${comboId}/taxes/999999`)
      .expect(404);
  });
});
