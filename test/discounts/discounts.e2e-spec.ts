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
import { RolesGuard } from 'src/common/guards/roles.guard';

import { DiscountsController } from '../../src/modules/discounts/discount/controllers/discounts.controller';
import { DiscountsService } from '../../src/modules/discounts/discount/services/discounts.service';
import { ShopCacheService } from '../../src/common/cache/shop-cache.service';
import { DiscountEntity } from '../../src/modules/discounts/discount/entities/discounts.entity';

import { DiscountProductTargetController } from '../../src/modules/discounts/discount-product-target/controllers/discount-product-target.controller';
import { DiscountProductTargetService } from '../../src/modules/discounts/discount-product-target/services/discount-product-target.service';
import { DiscountProductTargetEntity } from '../../src/modules/discounts/discount-product-target/entities/discount-product-target.entity';

import { DiscountComboTargetController } from '../../src/modules/discounts/discount-combo-target/controllers/discount-combo-target.controller';
import { DiscountComboTargetService } from '../../src/modules/discounts/discount-combo-target/services/discount-combo-target.service';
import { DiscountComboTargetEntity } from '../../src/modules/discounts/discount-combo-target/entities/discount-combo-target.entity';

import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

describe('Discounts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // IDs de datos base para los target tests
  let productId: number;
  let product2Id: number;
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
              DiscountEntity,
              DiscountProductTargetEntity,
              DiscountComboTargetEntity,
              CategoryEntity,
              ProductEntity,
              ProductImageEntity,
              ComboEntity,
              ComboItemEntity,
              ComboImageEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          DiscountEntity,
          DiscountProductTargetEntity,
          DiscountComboTargetEntity,
        ]),
      ],
      controllers: [
        DiscountsController,
        DiscountProductTargetController,
        DiscountComboTargetController,
      ],
      providers: [
        DiscountsService,
        DiscountProductTargetService,
        DiscountComboTargetService,
        {
          provide: ShopCacheService,
          useValue: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() },
        },
      ],
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

    // Seed: categoría compartida por productos y combos
    const category = await dataSource.manager.save(CategoryEntity, {
      name: 'Test Category',
      isActive: true,
    });

    // Seed: dos productos para testear conflictos de target
    const product = await dataSource.manager.save(ProductEntity, {
      sku: 'DISC-PROD-001',
      name: 'Producto Test 1',
      description: 'Descripción',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    productId = product.id;

    const product2 = await dataSource.manager.save(ProductEntity, {
      sku: 'DISC-PROD-002',
      name: 'Producto Test 2',
      description: 'Descripción',
      isActive: true,
      categoryId: category.id,
      measurementUnit: ProductMeasurementUnit.UNIT,
    });
    product2Id = product2.id;

    // Seed: dos combos para testear conflictos de target
    const combo = await dataSource.manager.save(ComboEntity, {
      name: 'Combo Test 1',
      description: 'Descripción',
      isActive: true,
      categoryId: category.id,
    });
    comboId = combo.id;

    const combo2 = await dataSource.manager.save(ComboEntity, {
      name: 'Combo Test 2',
      description: 'Descripción',
      isActive: true,
      categoryId: category.id,
    });
    combo2Id = combo2.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // ================================================================
  // DISCOUNTS — CRUD
  // ================================================================

  describe('POST /discounts', () => {
    it('201 — descuento porcentual sin fechas (ACTIVE)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Black Friday', value: 20, isPercentage: true })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Black Friday');
      expect(res.body.value).toBe(20);
      expect(res.body.isPercentage).toBe(true);
      expect(res.body.status).toBe('active');
      expect(res.body.currency).toBeUndefined();
    });

    it('201 — descuento porcentual con fechas futuras (SCHEDULED)', async () => {
      const future1 = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      const future2 = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString();

      const res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Promo Programada',
          value: 15,
          isPercentage: true,
          startsAt: future1,
          endsAt: future2,
        })
        .expect(201);

      expect(res.body.status).toBe('scheduled');
    });

    it('201 — descuento porcentual con fechas pasadas (EXPIRED)', async () => {
      const past1 = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
      const past2 = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

      const res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Promo Expirada',
          value: 5,
          isPercentage: true,
          startsAt: past1,
          endsAt: past2,
        })
        .expect(201);

      expect(res.body.status).toBe('expired');
    });

    it('201 — descuento de monto fijo con currency', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento Fijo ARS',
          value: 500,
          isPercentage: false,
          currency: 'ARS',
        })
        .expect(201);

      expect(res.body.isPercentage).toBe(false);
      expect(res.body.currency).toBe('ARS');
      expect(res.body.value).toBe(500);
    });

    it('201 — currency se limpia a null cuando isPercentage=true', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Porcentaje con currency ignorada',
          value: 10,
          isPercentage: true,
          currency: 'ARS',
        })
        .expect(201);

      expect(res.body.currency).toBeUndefined();
    });

    it('400 — faltan campos requeridos', async () => {
      await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({})
        .expect(400);
    });

    it('400 — porcentaje superior a 100', async () => {
      await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Inválido', value: 110, isPercentage: true })
        .expect(400);
    });

    it('400 — monto fijo sin currency', async () => {
      await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Sin moneda', value: 200, isPercentage: false })
        .expect(400);
    });

    it('400 — startsAt posterior a endsAt', async () => {
      await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Fechas inválidas',
          value: 10,
          isPercentage: true,
          startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          endsAt: new Date(Date.now()).toISOString(),
        })
        .expect(400);
    });

    it('400 — startsAt igual a endsAt (rango vacío)', async () => {
      const same = new Date().toISOString();
      await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Rango vacío',
          value: 10,
          isPercentage: true,
          startsAt: same,
          endsAt: same,
        })
        .expect(400);
    });
  });

  describe('GET /discounts', () => {
    it('200 — retorna estructura paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/discounts')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeDefined();
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.totalPages).toBeDefined();
      expect(typeof res.body.hasNextPage).toBe('boolean');
    });

    it('200 — respeta page y limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/discounts?page=1&limit=2')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.limit).toBe(2);
    });

    it('400 — si page=0', async () => {
      await request(app.getHttpServer())
        .get('/v1/discounts?page=0')
        .expect(400);
    });

    it('400 — si limit=0', async () => {
      await request(app.getHttpServer())
        .get('/v1/discounts?limit=0')
        .expect(400);
    });
  });

  describe('GET /discounts/:id', () => {
    it('200 — retorna el descuento por ID', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Para buscar por ID', value: 10, isPercentage: true });

      const res = await request(app.getHttpServer())
        .get(`/v1/discounts/${createRes.body.id}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.name).toBe('Para buscar por ID');
      expect(res.body.status).toBe('active');
    });

    it('404 — si el descuento no existe', async () => {
      await request(app.getHttpServer())
        .get('/v1/discounts/999999')
        .expect(404);
    });
  });

  describe('PATCH /discounts/:id', () => {
    it('200 — actualiza el nombre', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Nombre original', value: 10, isPercentage: true });

      const res = await request(app.getHttpServer())
        .patch(`/v1/discounts/${createRes.body.id}`)
        .send({ name: 'Nombre actualizado' })
        .expect(200);

      expect(res.body.name).toBe('Nombre actualizado');
      expect(res.body.value).toBe(10);
      expect(res.body.status).toBeDefined();
    });

    it('200 — actualiza el value manteniendo isPercentage', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Para actualizar value', value: 10, isPercentage: true });

      const res = await request(app.getHttpServer())
        .patch(`/v1/discounts/${createRes.body.id}`)
        .send({ value: 30 })
        .expect(200);

      expect(res.body.value).toBe(30);
      expect(res.body.isPercentage).toBe(true);
      expect(res.body.status).toBeDefined();
    });

    it('400 — porcentaje superior a 100 en update', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Para rechazar update', value: 10, isPercentage: true });

      await request(app.getHttpServer())
        .patch(`/v1/discounts/${createRes.body.id}`)
        .send({ value: 150 })
        .expect(400);
    });

    it('400 — startsAt posterior a endsAt en update', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Para fechas inválidas update',
          value: 10,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .patch(`/v1/discounts/${createRes.body.id}`)
        .send({
          startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          endsAt: new Date(Date.now()).toISOString(),
        })
        .expect(400);
    });

    it('404 — si el descuento no existe', async () => {
      await request(app.getHttpServer())
        .patch('/v1/discounts/999999')
        .send({ name: 'No existe' })
        .expect(404);
    });
  });

  describe('DELETE /discounts/:id', () => {
    it('204 — soft delete exitoso', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Para eliminar', value: 5, isPercentage: true });

      await request(app.getHttpServer())
        .delete(`/v1/discounts/${createRes.body.id}`)
        .expect(204);
    });

    it('404 — el descuento eliminado ya no es visible', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Para eliminar y verificar',
          value: 5,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .delete(`/v1/discounts/${createRes.body.id}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/v1/discounts/${createRes.body.id}`)
        .expect(404);
    });

    it('404 — si el descuento no existe', async () => {
      await request(app.getHttpServer())
        .delete('/v1/discounts/999999')
        .expect(404);
    });
  });

  // ================================================================
  // PRODUCT TARGETS
  // ================================================================

  describe('POST /discounts/:id/targets/products', () => {
    it('201 — asigna un producto a un descuento', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento para producto',
          value: 10,
          isPercentage: true,
        });

      const res = await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .send({ productId })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.discountId).toBe(discountRes.body.id);
      expect(res.body.productId).toBe(productId);
      expect(res.body.createdAt).toBeDefined();
    });

    it('409 — el mismo producto no puede asignarse dos veces al mismo descuento', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento duplicado producto',
          value: 10,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .send({ productId: product2Id });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .send({ productId: product2Id })
        .expect(409);
    });

    it('409 — un producto no puede tener más de un descuento activo', async () => {
      const discount1Res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento A para conflicto',
          value: 10,
          isPercentage: true,
        });

      const discount2Res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento B para conflicto',
          value: 20,
          isPercentage: true,
        });

      // Seed: busca un producto libre para este test
      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const extraProduct = await dataSource.manager.save(ProductEntity, {
        sku: 'DISC-CONFLICT-001',
        name: 'Producto Conflicto',
        description: 'Descripción',
        isActive: true,
        categoryId: category!.id,
        measurementUnit: ProductMeasurementUnit.UNIT,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discount1Res.body.id}/targets/products`)
        .send({ productId: extraProduct.id });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discount2Res.body.id}/targets/products`)
        .send({ productId: extraProduct.id })
        .expect(409);
    });

    it('404 — si el descuento no existe', async () => {
      await request(app.getHttpServer())
        .post('/v1/discounts/999999/targets/products')
        .send({ productId })
        .expect(404);
    });

    it('400 — si falta productId en el body', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento para validación',
          value: 10,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /discounts/:id/targets/products', () => {
    it('200 — retorna los productos asignados', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento GET productos',
          value: 10,
          isPercentage: true,
        });

      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const extraProduct = await dataSource.manager.save(ProductEntity, {
        sku: 'DISC-GET-001',
        name: 'Producto GET',
        description: 'Descripción',
        isActive: true,
        categoryId: category!.id,
        measurementUnit: ProductMeasurementUnit.UNIT,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .send({ productId: extraProduct.id });

      const res = await request(app.getHttpServer())
        .get(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].productId).toBe(extraProduct.id);
    });

    it('200 — retorna array vacío si no hay targets', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Sin targets producto', value: 10, isPercentage: true });

      const res = await request(app.getHttpServer())
        .get(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('404 — si el descuento no existe', async () => {
      await request(app.getHttpServer())
        .get('/v1/discounts/999999/targets/products')
        .expect(404);
    });
  });

  describe('DELETE /discounts/:id/targets/products/:productId', () => {
    it('204 — elimina el target (soft delete) y ya no aparece en el listado', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento DELETE producto',
          value: 10,
          isPercentage: true,
        });

      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const extraProduct = await dataSource.manager.save(ProductEntity, {
        sku: 'DISC-DEL-PROD-001',
        name: 'Producto a desasignar',
        description: 'Descripción',
        isActive: true,
        categoryId: category!.id,
        measurementUnit: ProductMeasurementUnit.UNIT,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .send({ productId: extraProduct.id });

      await request(app.getHttpServer())
        .delete(
          `/v1/discounts/${discountRes.body.id}/targets/products/${extraProduct.id}`,
        )
        .expect(204);

      const listRes = await request(app.getHttpServer())
        .get(`/v1/discounts/${discountRes.body.id}/targets/products`)
        .expect(200);

      expect(listRes.body).toEqual([]);
    });

    it('404 — si el target no existe', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento para 404 target',
          value: 10,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .delete(`/v1/discounts/${discountRes.body.id}/targets/products/999999`)
        .expect(404);
    });

    it('201 — un producto puede reasignarse a otro descuento después de eliminar el target', async () => {
      const d1 = await request(app.getHttpServer()).post('/v1/discounts').send({
        name: 'Descuento reasign prod 1',
        value: 10,
        isPercentage: true,
      });
      const d2 = await request(app.getHttpServer()).post('/v1/discounts').send({
        name: 'Descuento reasign prod 2',
        value: 20,
        isPercentage: true,
      });

      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const p = await dataSource.manager.save(ProductEntity, {
        sku: 'DISC-REASIGN-PROD-001',
        name: 'Producto Reasignable',
        description: 'X',
        isActive: true,
        categoryId: category!.id,
        measurementUnit: ProductMeasurementUnit.UNIT,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${d1.body.id}/targets/products`)
        .send({ productId: p.id });

      await request(app.getHttpServer())
        .delete(`/v1/discounts/${d1.body.id}/targets/products/${p.id}`)
        .expect(204);

      await request(app.getHttpServer())
        .post(`/v1/discounts/${d2.body.id}/targets/products`)
        .send({ productId: p.id })
        .expect(201);
    });
  });

  // ================================================================
  // COMBO TARGETS
  // ================================================================

  describe('POST /discounts/:id/targets/combos', () => {
    it('201 — asigna un combo a un descuento', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Descuento para combo', value: 10, isPercentage: true });

      const res = await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .send({ comboId })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.discountId).toBe(discountRes.body.id);
      expect(res.body.comboId).toBe(comboId);
      expect(res.body.createdAt).toBeDefined();
    });

    it('409 — el mismo combo no puede asignarse dos veces al mismo descuento', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento duplicado combo',
          value: 10,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .send({ comboId: combo2Id });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .send({ comboId: combo2Id })
        .expect(409);
    });

    it('409 — un combo no puede tener más de un descuento activo', async () => {
      const discount1Res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento A combo conflicto',
          value: 10,
          isPercentage: true,
        });

      const discount2Res = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento B combo conflicto',
          value: 20,
          isPercentage: true,
        });

      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const extraCombo = await dataSource.manager.save(ComboEntity, {
        name: 'Combo Conflicto',
        description: 'Descripción',
        isActive: true,
        categoryId: category!.id,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discount1Res.body.id}/targets/combos`)
        .send({ comboId: extraCombo.id });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discount2Res.body.id}/targets/combos`)
        .send({ comboId: extraCombo.id })
        .expect(409);
    });

    it('404 — si el descuento no existe', async () => {
      await request(app.getHttpServer())
        .post('/v1/discounts/999999/targets/combos')
        .send({ comboId })
        .expect(404);
    });

    it('400 — si falta comboId en el body', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento validación combo',
          value: 10,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /discounts/:id/targets/combos', () => {
    it('200 — retorna los combos asignados', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Descuento GET combos', value: 10, isPercentage: true });

      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const extraCombo = await dataSource.manager.save(ComboEntity, {
        name: 'Combo GET',
        description: 'Descripción',
        isActive: true,
        categoryId: category!.id,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .send({ comboId: extraCombo.id });

      const res = await request(app.getHttpServer())
        .get(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].comboId).toBe(extraCombo.id);
    });

    it('200 — retorna array vacío si no hay targets', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({ name: 'Sin targets combo', value: 10, isPercentage: true });

      const res = await request(app.getHttpServer())
        .get(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('404 — si el descuento no existe', async () => {
      await request(app.getHttpServer())
        .get('/v1/discounts/999999/targets/combos')
        .expect(404);
    });
  });

  describe('DELETE /discounts/:id/targets/combos/:comboId', () => {
    it('204 — elimina el target (soft delete) y ya no aparece en el listado', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento DELETE combo',
          value: 10,
          isPercentage: true,
        });

      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const extraCombo = await dataSource.manager.save(ComboEntity, {
        name: 'Combo a desasignar',
        description: 'Descripción',
        isActive: true,
        categoryId: category!.id,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .send({ comboId: extraCombo.id });

      await request(app.getHttpServer())
        .delete(
          `/v1/discounts/${discountRes.body.id}/targets/combos/${extraCombo.id}`,
        )
        .expect(204);

      const listRes = await request(app.getHttpServer())
        .get(`/v1/discounts/${discountRes.body.id}/targets/combos`)
        .expect(200);

      expect(listRes.body).toEqual([]);
    });

    it('404 — si el target no existe', async () => {
      const discountRes = await request(app.getHttpServer())
        .post('/v1/discounts')
        .send({
          name: 'Descuento para 404 combo target',
          value: 10,
          isPercentage: true,
        });

      await request(app.getHttpServer())
        .delete(`/v1/discounts/${discountRes.body.id}/targets/combos/999999`)
        .expect(404);
    });

    it('201 — un combo puede reasignarse a otro descuento después de eliminar el target', async () => {
      const d1 = await request(app.getHttpServer()).post('/v1/discounts').send({
        name: 'Descuento reasign combo 1',
        value: 10,
        isPercentage: true,
      });
      const d2 = await request(app.getHttpServer()).post('/v1/discounts').send({
        name: 'Descuento reasign combo 2',
        value: 20,
        isPercentage: true,
      });

      const category = await dataSource.manager.findOne(CategoryEntity, {
        where: { name: 'Test Category' },
      });
      const c = await dataSource.manager.save(ComboEntity, {
        name: 'Combo Reasignable',
        description: 'X',
        isActive: true,
        categoryId: category!.id,
      });

      await request(app.getHttpServer())
        .post(`/v1/discounts/${d1.body.id}/targets/combos`)
        .send({ comboId: c.id });

      await request(app.getHttpServer())
        .delete(`/v1/discounts/${d1.body.id}/targets/combos/${c.id}`)
        .expect(204);

      await request(app.getHttpServer())
        .post(`/v1/discounts/${d2.body.id}/targets/combos`)
        .send({ comboId: c.id })
        .expect(201);
    });
  });
});
