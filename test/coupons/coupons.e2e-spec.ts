import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { CouponController } from '../../src/modules/coupons/coupon/controllers/coupon.controller';
import { CouponService } from '../../src/modules/coupons/coupon/services/coupon.service';
import { CouponEntity } from '../../src/modules/coupons/coupon/entities/coupon.entity';

import { CouponProductTargetController } from '../../src/modules/coupons/coupon-product-target/controllers/coupon-product-target.controller';
import { CouponProductTargetService } from '../../src/modules/coupons/coupon-product-target/services/coupon-product-target.service';
import { CouponProductTargetEntity } from '../../src/modules/coupons/coupon-product-target/entities/coupon-product-target.entity';
import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';

import { CouponComboTargetController } from '../../src/modules/coupons/coupon-combo-target/controllers/coupon-combo-target.controller';
import { CouponComboTargetService } from '../../src/modules/coupons/coupon-combo-target/services/coupon-combo-target.service';
import { CouponComboTargetEntity } from '../../src/modules/coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';

describe('Coupons (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let fixedCouponId: number;
  let globalCouponId: number;

  // ProductEntity and ComboEntity are used only for existence validation in services.
  // They are mocked to avoid pulling the full products dependency chain into the schema.
  const mockProductRepo = {
    findOne: () => Promise.resolve({ id: 1, name: 'Mock Product' }),
  };
  const mockComboRepo = {
    findOne: () => Promise.resolve({ id: 1, name: 'Mock Combo' }),
  };

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
              CouponEntity,
              CouponProductTargetEntity,
              CouponComboTargetEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          CouponEntity,
          CouponProductTargetEntity,
          CouponComboTargetEntity,
        ]),
      ],
      controllers: [
        CouponController,
        CouponProductTargetController,
        CouponComboTargetController,
      ],
      providers: [
        CouponService,
        CouponProductTargetService,
        CouponComboTargetService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: mockProductRepo,
        },
        { provide: getRepositoryToken(ComboEntity), useValue: mockComboRepo },
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

    await app.init();
    dataSource = moduleFixture.get(DataSource);

    // Seed coupons reutilizados en múltiples bloques
    const fixedRes = await request(app.getHttpServer())
      .post('/coupons')
      .send({
        code: 'FIXED100',
        value: 100,
        isPercentage: false,
        currency: 'ARS',
        isGlobal: false,
      })
      .expect(201);
    fixedCouponId = fixedRes.body.id;

    const globalRes = await request(app.getHttpServer())
      .post('/coupons')
      .send({ code: 'GLOBAL5', value: 5, isPercentage: true, isGlobal: true })
      .expect(201);
    globalCouponId = globalRes.body.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // POST /coupons
  // =============================================

  describe('POST /coupons', () => {
    it('201 — crea cupón con porcentaje', async () => {
      const res = await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'PERCENT10',
          value: 10,
          isPercentage: true,
          isGlobal: false,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBe('PERCENT10');
      expect(res.body.status).toBe('active');
      expect(res.body.isPercentage).toBe(true);
      expect(res.body.currency).toBeUndefined();
    });

    it('201 — crea cupón con usageLimit y fechas', async () => {
      const res = await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'LIMITED',
          value: 200,
          isPercentage: false,
          currency: 'ARS',
          isGlobal: false,
          usageLimit: 5,
          startsAt: new Date(Date.now() - 86400000).toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);

      expect(res.body.usageLimit).toBe(5);
      expect(res.body.status).toBe('active');
    });

    it('400 — body vacío', async () => {
      await request(app.getHttpServer()).post('/coupons').send({}).expect(400);
    });

    it('400 — porcentaje mayor a 100', async () => {
      await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'OVER100',
          value: 101,
          isPercentage: true,
          isGlobal: false,
        })
        .expect(400);
    });

    it('400 — cupón fijo sin currency', async () => {
      await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'NOCURR',
          value: 50,
          isPercentage: false,
          isGlobal: false,
        })
        .expect(400);
    });

    it('400 — porcentaje con currency enviada', async () => {
      await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'BADPERC',
          value: 10,
          isPercentage: true,
          currency: 'ARS',
          isGlobal: false,
        })
        .expect(400);
    });

    it('400 — startsAt posterior a endsAt', async () => {
      await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'BADDATE',
          value: 10,
          isPercentage: true,
          isGlobal: false,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() - 86400000).toISOString(),
        })
        .expect(400);
    });

    it('409 — código duplicado', async () => {
      await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'FIXED100',
          value: 50,
          isPercentage: false,
          currency: 'ARS',
          isGlobal: false,
        })
        .expect(409);
    });
  });

  // =============================================
  // GET /coupons
  // =============================================

  describe('GET /coupons', () => {
    it('200 — retorna lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/coupons')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.page).toBe(1);
    });

    it('200 — respeta limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/coupons?page=1&limit=1')
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.limit).toBe(1);
    });
  });

  // =============================================
  // GET /coupons/:id
  // =============================================

  describe('GET /coupons/:id', () => {
    it('200 — retorna cupón por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/coupons/${fixedCouponId}`)
        .expect(200);

      expect(res.body.id).toBe(fixedCouponId);
      expect(res.body.code).toBe('FIXED100');
      expect(res.body.status).toBeDefined();
    });

    it('404 — id inexistente', async () => {
      await request(app.getHttpServer()).get('/coupons/999999').expect(404);
    });
  });

  // =============================================
  // PATCH /coupons/:id
  // =============================================

  describe('PATCH /coupons/:id', () => {
    it('200 — actualiza usageLimit', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/coupons/${fixedCouponId}`)
        .send({ usageLimit: 50 })
        .expect(200);
      expect(res.body.usageLimit).toBe(50);
    });

    it('409 — código duplicado en update', async () => {
      await request(app.getHttpServer())
        .patch(`/coupons/${fixedCouponId}`)
        .send({ code: 'GLOBAL5' })
        .expect(409);
    });

    it('404 — id inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/coupons/999999')
        .send({ usageLimit: 10 })
        .expect(404);
    });
  });

  // =============================================
  // DELETE /coupons/:id
  // =============================================

  describe('DELETE /coupons/:id', () => {
    let deleteId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/coupons')
        .send({
          code: 'TODELETE',
          value: 5,
          isPercentage: true,
          isGlobal: false,
        })
        .expect(201);
      deleteId = res.body.id;
    });

    it('204 — elimina cupón', async () => {
      await request(app.getHttpServer())
        .delete(`/coupons/${deleteId}`)
        .expect(204);
    });

    it('404 — cupón ya eliminado no aparece en GET', async () => {
      await request(app.getHttpServer())
        .get(`/coupons/${deleteId}`)
        .expect(404);
    });

    it('404 — id inexistente', async () => {
      await request(app.getHttpServer()).delete('/coupons/999999').expect(404);
    });
  });

  // =============================================
  // PRODUCT TARGETS
  // =============================================

  describe('POST /coupons/:couponId/targets/products', () => {
    it('201 — asigna producto a cupón', async () => {
      const res = await request(app.getHttpServer())
        .post(`/coupons/${fixedCouponId}/targets/products`)
        .send({ productId: 1 })
        .expect(201);

      expect(res.body.couponId).toBe(fixedCouponId);
      expect(res.body.productId).toBe(1);
      expect(res.body.id).toBeDefined();
    });

    it('409 — target duplicado', async () => {
      await request(app.getHttpServer())
        .post(`/coupons/${fixedCouponId}/targets/products`)
        .send({ productId: 1 })
        .expect(409);
    });

    it('409 — cupón global no acepta targets', async () => {
      await request(app.getHttpServer())
        .post(`/coupons/${globalCouponId}/targets/products`)
        .send({ productId: 2 })
        .expect(409);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .post('/coupons/999999/targets/products')
        .send({ productId: 1 })
        .expect(404);
    });

    it('400 — productId inválido', async () => {
      await request(app.getHttpServer())
        .post(`/coupons/${fixedCouponId}/targets/products`)
        .send({ productId: 0 })
        .expect(400);
    });
  });

  describe('GET /coupons/:couponId/targets/products', () => {
    it('200 — lista los products targets del cupón', async () => {
      const res = await request(app.getHttpServer())
        .get(`/coupons/${fixedCouponId}/targets/products`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].productId).toBe(1);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .get('/coupons/999999/targets/products')
        .expect(404);
    });
  });

  describe('DELETE /coupons/:couponId/targets/products/:productId', () => {
    it('204 — elimina product target', async () => {
      await request(app.getHttpServer())
        .delete(`/coupons/${fixedCouponId}/targets/products/1`)
        .expect(204);
    });

    it('404 — target ya eliminado', async () => {
      await request(app.getHttpServer())
        .delete(`/coupons/${fixedCouponId}/targets/products/1`)
        .expect(404);
    });
  });

  // =============================================
  // COMBO TARGETS
  // =============================================

  describe('POST /coupons/:couponId/targets/combos', () => {
    it('201 — asigna combo a cupón', async () => {
      const res = await request(app.getHttpServer())
        .post(`/coupons/${fixedCouponId}/targets/combos`)
        .send({ comboId: 1 })
        .expect(201);

      expect(res.body.couponId).toBe(fixedCouponId);
      expect(res.body.comboId).toBe(1);
      expect(res.body.id).toBeDefined();
    });

    it('409 — target duplicado', async () => {
      await request(app.getHttpServer())
        .post(`/coupons/${fixedCouponId}/targets/combos`)
        .send({ comboId: 1 })
        .expect(409);
    });

    it('409 — cupón global no acepta targets', async () => {
      await request(app.getHttpServer())
        .post(`/coupons/${globalCouponId}/targets/combos`)
        .send({ comboId: 2 })
        .expect(409);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .post('/coupons/999999/targets/combos')
        .send({ comboId: 1 })
        .expect(404);
    });

    it('400 — comboId inválido', async () => {
      await request(app.getHttpServer())
        .post(`/coupons/${fixedCouponId}/targets/combos`)
        .send({ comboId: 0 })
        .expect(400);
    });
  });

  describe('GET /coupons/:couponId/targets/combos', () => {
    it('200 — lista los combo targets del cupón', async () => {
      const res = await request(app.getHttpServer())
        .get(`/coupons/${fixedCouponId}/targets/combos`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].comboId).toBe(1);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .get('/coupons/999999/targets/combos')
        .expect(404);
    });
  });

  describe('DELETE /coupons/:couponId/targets/combos/:comboId', () => {
    it('204 — elimina combo target', async () => {
      await request(app.getHttpServer())
        .delete(`/coupons/${fixedCouponId}/targets/combos/1`)
        .expect(204);
    });

    it('404 — target ya eliminado', async () => {
      await request(app.getHttpServer())
        .delete(`/coupons/${fixedCouponId}/targets/combos/1`)
        .expect(404);
    });
  });
});
