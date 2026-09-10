import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../src/common/guards/roles.guard';

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
import { CouponUsageEntity } from '../../src/modules/coupons/usage/entities/coupon-usage.entity';
import { CouponUsageService } from '../../src/modules/coupons/usage/services/coupon-usage.service';
import { CouponUsageController } from '../../src/modules/coupons/usage/controllers/coupon-usage.controller';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';

import { ProfileEntity } from '../../src/modules/users/entities/profile.entity';
import { RoleEntity } from '../../src/modules/users/entities/role.entity';
import { UserEntity } from '../../src/modules/users/entities/user.entity';
import { OrderEntity } from '../../src/modules/orders/entities/order.entity';
import { OrderItemEntity } from '../../src/modules/orders/entities/order-item.entity';
import { DeliveryType } from '../../src/modules/orders/enums/delivery-type.enum';

describe('Coupons (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let fixedCouponId: number;
  let globalCouponId: number;
  let testUser: UserEntity;

  // ProductEntity and ComboEntity are used only for existence validation in services.
  // They are mocked to avoid pulling the full products dependency chain into the schema.
  const mockProductRepo = {
    // 999999 se reserva como sentinel de "no existe" (mismo criterio que
    // se usa en todo el archivo para ids inexistentes de cupón)
    findOne: ({ where }: any) =>
      where?.id === 999999
        ? Promise.resolve(null)
        : Promise.resolve({ id: where?.id ?? 1, name: 'Mock Product' }),
  };
  const mockComboRepo = {
    // 999999 se reserva como sentinel de "no existe" (mismo criterio que
    // se usa en todo el archivo para ids inexistentes de cupón)
    findOne: ({ where }: any) =>
      where?.id === 999999
        ? Promise.resolve(null)
        : Promise.resolve({ id: where?.id ?? 1, name: 'Mock Combo' }),
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
              CouponUsageEntity,
              ProfileEntity,
              RoleEntity,
              UserEntity,
              OrderEntity,
              OrderItemEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          CouponEntity,
          CouponProductTargetEntity,
          CouponComboTargetEntity,
          CouponUsageEntity,
          UserEntity,
        ]),
      ],
      controllers: [
        CouponController,
        CouponProductTargetController,
        CouponComboTargetController,
        CouponUsageController,
      ],
      providers: [
        CouponService,
        CouponProductTargetService,
        CouponComboTargetService,
        CouponUsageService,
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

    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    // Seed profile → user, usado para simular un uso real de cupón (ver
    // 409 — no se puede eliminar un cupón ya utilizado)
    const profile = await dataSource.getRepository(ProfileEntity).save(
      dataSource.getRepository(ProfileEntity).create({
        name: 'Test',
        lastName: 'User',
      }),
    );
    testUser = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: 'coupons-e2e@test.com',
        password: 'password',
        isActive: true,
        profileId: profile.id,
      }),
    );

    // Seed coupons reutilizados en múltiples bloques
    const fixedRes = await request(app.getHttpServer())
      .post('/v1/coupons')
      .send({
        code: 'FIXED100',
        value: 20,
        isGlobal: false,
      })
      .expect(201);
    fixedCouponId = fixedRes.body.id;

    const globalRes = await request(app.getHttpServer())
      .post('/v1/coupons')
      .send({ code: 'GLOBAL5', value: 5, isGlobal: true })
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
    it('201 — crea cupón porcentual', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'PERCENT10', value: 10, isGlobal: false })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBe('PERCENT10');
      expect(res.body.status).toBe('active');
      expect(res.body.value).toBe(10);
    });

    it('201 — crea cupón con usageLimit y fechas', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({
          code: 'LIMITED',
          value: 15,
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
      await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({})
        .expect(400);
    });

    it('400 — value mayor a 100', async () => {
      await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'OVER100', value: 101, isGlobal: false })
        .expect(400);
    });

    it('400 — value menor a 0.01', async () => {
      await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'ZERO', value: 0, isGlobal: false })
        .expect(400);
    });

    it('400 — campo forbidden (isPercentage ya no existe)', async () => {
      await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({
          code: 'BADFIELD',
          value: 10,
          isGlobal: false,
          isPercentage: true,
        })
        .expect(400);
    });

    it('400 — startsAt posterior a endsAt', async () => {
      await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({
          code: 'BADDATE',
          value: 10,
          isGlobal: false,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() - 86400000).toISOString(),
        })
        .expect(400);
    });

    it('409 — código duplicado', async () => {
      await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'FIXED100', value: 20, isGlobal: false })
        .expect(409);
    });
  });

  // =============================================
  // GET /coupons
  // =============================================

  describe('GET /coupons', () => {
    it('200 — retorna lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/coupons')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.page).toBe(1);
    });

    it('200 — respeta limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/coupons?page=1&limit=1')
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
        .get(`/v1/coupons/${fixedCouponId}`)
        .expect(200);

      expect(res.body.id).toBe(fixedCouponId);
      expect(res.body.code).toBe('FIXED100');
      expect(res.body.status).toBeDefined();
    });

    it('404 — id inexistente', async () => {
      await request(app.getHttpServer()).get('/v1/coupons/999999').expect(404);
    });
  });

  // =============================================
  // PATCH /coupons/:id
  // =============================================

  describe('PATCH /coupons/:id', () => {
    it('200 — actualiza usageLimit', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/coupons/${fixedCouponId}`)
        .send({ usageLimit: 50 })
        .expect(200);
      expect(res.body.usageLimit).toBe(50);
    });

    it('409 — código duplicado en update', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/coupons/${fixedCouponId}`)
        .send({ code: 'GLOBAL5' })
        .expect(409);
    });

    it('404 — id inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/v1/coupons/999999')
        .send({ usageLimit: 10 })
        .expect(404);
    });

    it('400 — value fuera de rango', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/coupons/${fixedCouponId}`)
        .send({ value: 101 })
        .expect(400);
    });

    it('400 — startsAt posterior a endsAt', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/coupons/${fixedCouponId}`)
        .send({
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() - 86400000).toISOString(),
        })
        .expect(400);
    });

    it('400 — usageLimit menor al uso ya consumido', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'CONUSO', value: 10, isGlobal: true, usageLimit: 10 })
        .expect(201);
      await dataSource
        .getRepository(CouponEntity)
        .update(res.body.id, { usageCount: 5 });

      await request(app.getHttpServer())
        .patch(`/v1/coupons/${res.body.id}`)
        .send({ usageLimit: 2 })
        .expect(400);
    });

    it('400 — no se puede marcar como global un cupón con targets asignados', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'CONTARGET', value: 10, isGlobal: false })
        .expect(201);
      const couponId = res.body.id;

      await request(app.getHttpServer())
        .post(`/v1/coupons/${couponId}/targets/products`)
        .send({ productId: 77 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/coupons/${couponId}`)
        .send({ isGlobal: true })
        .expect(400);
    });

    it('200 — permite marcar como global un cupón sin targets', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'SINTARGET', value: 10, isGlobal: false })
        .expect(201);

      const patchRes = await request(app.getHttpServer())
        .patch(`/v1/coupons/${res.body.id}`)
        .send({ isGlobal: true })
        .expect(200);

      expect(patchRes.body.isGlobal).toBe(true);
    });
  });

  // =============================================
  // DELETE /coupons/:id
  // =============================================

  describe('DELETE /coupons/:id', () => {
    let deleteId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'TODELETE', value: 5, isGlobal: false })
        .expect(201);
      deleteId = res.body.id;
    });

    it('204 — elimina cupón', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/coupons/${deleteId}`)
        .expect(204);
    });

    it('404 — cupón ya eliminado no aparece en GET', async () => {
      await request(app.getHttpServer())
        .get(`/v1/coupons/${deleteId}`)
        .expect(404);
    });

    it('404 — id inexistente', async () => {
      await request(app.getHttpServer())
        .delete('/v1/coupons/999999')
        .expect(404);
    });

    it('409 — no se puede eliminar un cupón ya utilizado', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'USADO', value: 5, isGlobal: false })
        .expect(201);
      const couponId = res.body.id;

      // Simula una orden real que usó el cupón — remove() cuenta usos reales
      // (manager.count sobre la misma transacción que lockea el cupón).
      const order = await dataSource.getRepository(OrderEntity).save(
        dataSource.getRepository(OrderEntity).create({
          userId: testUser.id,
          deliveryType: DeliveryType.PICKUP,
          subtotal: 100,
          total: 95,
          couponId,
        }),
      );
      await dataSource.getRepository(CouponUsageEntity).save(
        dataSource.getRepository(CouponUsageEntity).create({
          couponId,
          userId: testUser.id,
          orderId: order.id,
          appliedAt: new Date(),
        }),
      );

      await request(app.getHttpServer())
        .delete(`/v1/coupons/${couponId}`)
        .expect(409);
    });
  });

  // =============================================
  // PRODUCT TARGETS
  // =============================================

  describe('POST /coupons/:couponId/targets/products', () => {
    it('201 — asigna producto a cupón', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/products`)
        .send({ productId: 1 })
        .expect(201);

      expect(res.body.couponId).toBe(fixedCouponId);
      expect(res.body.productId).toBe(1);
      expect(res.body.id).toBeDefined();
    });

    it('409 — target duplicado', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/products`)
        .send({ productId: 1 })
        .expect(409);
    });

    it('409 — cupón global no acepta targets', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${globalCouponId}/targets/products`)
        .send({ productId: 2 })
        .expect(409);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .post('/v1/coupons/999999/targets/products')
        .send({ productId: 1 })
        .expect(404);
    });

    it('404 — producto inexistente', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/products`)
        .send({ productId: 999999 })
        .expect(404);
    });

    it('400 — productId inválido', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/products`)
        .send({ productId: 0 })
        .expect(400);
    });

    it('400 — cupón expirado', async () => {
      const coupon = await dataSource.getRepository(CouponEntity).save(
        dataSource.getRepository(CouponEntity).create({
          code: 'PRODVENCIDO',
          value: 10,
          isGlobal: false,
          endsAt: new Date(Date.now() - 60000),
        }),
      );

      await request(app.getHttpServer())
        .post(`/v1/coupons/${coupon.id}/targets/products`)
        .send({ productId: 5 })
        .expect(400);
    });

    it('400 — cupón agotado', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({
          code: 'PRODAGOTADO',
          value: 10,
          isGlobal: false,
          usageLimit: 1,
        })
        .expect(201);
      await dataSource
        .getRepository(CouponEntity)
        .update(res.body.id, { usageCount: 1 });

      await request(app.getHttpServer())
        .post(`/v1/coupons/${res.body.id}/targets/products`)
        .send({ productId: 5 })
        .expect(400);
    });
  });

  describe('GET /coupons/:couponId/targets/products', () => {
    it('200 — lista los products targets del cupón', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/coupons/${fixedCouponId}/targets/products`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].productId).toBe(1);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .get('/v1/coupons/999999/targets/products')
        .expect(404);
    });
  });

  describe('DELETE /coupons/:couponId/targets/products/:productId', () => {
    it('204 — elimina product target', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/coupons/${fixedCouponId}/targets/products/1`)
        .expect(204);
    });

    it('404 — target ya eliminado', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/coupons/${fixedCouponId}/targets/products/1`)
        .expect(404);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .delete('/v1/coupons/999999/targets/products/1')
        .expect(404);
    });
  });

  // =============================================
  // COMBO TARGETS
  // =============================================

  describe('POST /coupons/:couponId/targets/combos', () => {
    it('201 — asigna combo a cupón', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/combos`)
        .send({ comboId: 1 })
        .expect(201);

      expect(res.body.couponId).toBe(fixedCouponId);
      expect(res.body.comboId).toBe(1);
      expect(res.body.id).toBeDefined();
    });

    it('409 — target duplicado', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/combos`)
        .send({ comboId: 1 })
        .expect(409);
    });

    it('409 — cupón global no acepta targets', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${globalCouponId}/targets/combos`)
        .send({ comboId: 2 })
        .expect(409);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .post('/v1/coupons/999999/targets/combos')
        .send({ comboId: 1 })
        .expect(404);
    });

    it('404 — combo inexistente', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/combos`)
        .send({ comboId: 999999 })
        .expect(404);
    });

    it('400 — comboId inválido', async () => {
      await request(app.getHttpServer())
        .post(`/v1/coupons/${fixedCouponId}/targets/combos`)
        .send({ comboId: 0 })
        .expect(400);
    });

    it('400 — cupón expirado', async () => {
      const coupon = await dataSource.getRepository(CouponEntity).save(
        dataSource.getRepository(CouponEntity).create({
          code: 'COMBOVENCIDO',
          value: 10,
          isGlobal: false,
          endsAt: new Date(Date.now() - 60000),
        }),
      );

      await request(app.getHttpServer())
        .post(`/v1/coupons/${coupon.id}/targets/combos`)
        .send({ comboId: 5 })
        .expect(400);
    });

    it('400 — cupón agotado', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({
          code: 'COMBOAGOTADO',
          value: 10,
          isGlobal: false,
          usageLimit: 1,
        })
        .expect(201);
      await dataSource
        .getRepository(CouponEntity)
        .update(res.body.id, { usageCount: 1 });

      await request(app.getHttpServer())
        .post(`/v1/coupons/${res.body.id}/targets/combos`)
        .send({ comboId: 5 })
        .expect(400);
    });
  });

  describe('GET /coupons/:couponId/targets/combos', () => {
    it('200 — lista los combo targets del cupón', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/coupons/${fixedCouponId}/targets/combos`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].comboId).toBe(1);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .get('/v1/coupons/999999/targets/combos')
        .expect(404);
    });
  });

  describe('DELETE /coupons/:couponId/targets/combos/:comboId', () => {
    it('204 — elimina combo target', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/coupons/${fixedCouponId}/targets/combos/1`)
        .expect(204);
    });

    it('404 — target ya eliminado', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/coupons/${fixedCouponId}/targets/combos/1`)
        .expect(404);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .delete('/v1/coupons/999999/targets/combos/1')
        .expect(404);
    });
  });

  // =============================================
  // COUPON USAGE (solo lectura — el alta vive en OrdersModule)
  // =============================================

  describe('GET /coupon-usage*', () => {
    let usageCouponId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/coupons')
        .send({ code: 'CONUSOREAL', value: 10, isGlobal: true })
        .expect(201);
      usageCouponId = res.body.id;

      const order = await dataSource.getRepository(OrderEntity).save(
        dataSource.getRepository(OrderEntity).create({
          userId: testUser.id,
          deliveryType: DeliveryType.PICKUP,
          subtotal: 100,
          total: 90,
          couponId: usageCouponId,
        }),
      );
      await dataSource.getRepository(CouponUsageEntity).save(
        dataSource.getRepository(CouponUsageEntity).create({
          couponId: usageCouponId,
          userId: testUser.id,
          orderId: order.id,
          appliedAt: new Date(),
        }),
      );
    });

    it('200 — GET /coupon-usage lista paginado', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/coupon-usage')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('200 — GET /coupon-usage/coupon/:couponId devuelve los usos del cupón', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/coupon-usage/coupon/${usageCouponId}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].couponId).toBe(usageCouponId);
      expect(res.body[0].userId).toBe(testUser.id);
    });

    it('404 — GET /coupon-usage/coupon/:couponId con cupón inexistente', async () => {
      await request(app.getHttpServer())
        .get('/v1/coupon-usage/coupon/999999')
        .expect(404);
    });

    it('200 — GET /coupon-usage/user/:userId devuelve los usos del usuario', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/coupon-usage/user/${testUser.id}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].userId).toBe(testUser.id);
    });

    it('404 — GET /coupon-usage/user/:userId con usuario inexistente', async () => {
      await request(app.getHttpServer())
        .get('/v1/coupon-usage/user/999999')
        .expect(404);
    });
  });
});
