import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../src/common/guards/roles.guard';

import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';
import { OrdersService } from '../../src/modules/orders/services/orders.service';
import { OrderEntity } from '../../src/modules/orders/entities/order.entity';
import { OrderItemEntity } from '../../src/modules/orders/entities/order-item.entity';
import { DeliveryType } from '../../src/modules/orders/enums/delivery-type.enum';
import { OrderStatus } from '../../src/modules/orders/enums/order-status.enum';

import { UserEntity } from '../../src/modules/users/entities/user.entity';
import { ProfileEntity } from '../../src/modules/users/entities/profile.entity';
import { RoleEntity } from '../../src/modules/users/entities/role.entity';

import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';
import { ProductMeasurementUnit } from '../../src/modules/products/product/enums/product-measurement-unit.enum';

import { StockItemsService } from '../../src/modules/stocks/stock-item/services/stock-item.service';
import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockMovementEntity } from '../../src/modules/stocks/stock-movement/entities/stock-movement.entity';
import { StockWriteOffEntity } from '../../src/modules/stocks/stock-writeoff/entities/stock-writeoff.entity';
import { StockLocationType } from '../../src/modules/stocks/stock-locations/enums/stock-location-type.enum';

import { CouponEntity } from '../../src/modules/coupons/coupon/entities/coupon.entity';
import { CouponProductTargetEntity } from '../../src/modules/coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from '../../src/modules/coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { CouponUsageEntity } from '../../src/modules/coupons/usage/entities/coupon-usage.entity';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CalculationService } from '../../src/modules/pricing/calculation/services/calculation.service';
import { MailService } from '../../src/modules/mail/services/mail.service';
import { RoleType } from '../../src/common/enums/role-type.enum';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let userId: number;
  let productId: number;
  let comboId: number;
  let couponCode: string;

  const mockUser: { sub: number; role: string } = {
    sub: 0,
    role: RoleType.ADMIN,
  };

  const mockCalcService = {
    calculateProduct: jest.fn().mockResolvedValue({
      unitPrice: 1000,
      salePrice: 1000,
      finalPrice: 1000,
      discount: 0,
      fullPrice: 1000,
      coupon: 0,
      orderTotal: 1000,
    }),
    calculateCombo: jest.fn().mockResolvedValue({
      unitPrice: 2000,
      salePrice: 2000,
      finalPrice: 2000,
      discount: 0,
      fullPrice: 2000,
      coupon: 0,
      orderTotal: 2000,
    }),
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
              OrderEntity,
              OrderItemEntity,
              UserEntity,
              ProfileEntity,
              RoleEntity,
              ProductEntity,
              CategoryEntity,
              ProductImageEntity,
              ComboEntity,
              ComboItemEntity,
              ComboImageEntity,
              StockItemEntity,
              StockLocationEntity,
              StockMovementEntity,
              StockWriteOffEntity,
              CouponEntity,
              CouponProductTargetEntity,
              CouponComboTargetEntity,
              CouponUsageEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          OrderEntity,
          OrderItemEntity,
          ProductEntity,
          ComboEntity,
          StockItemEntity,
          StockMovementEntity,
          StockWriteOffEntity,
          ComboItemEntity,
          UserEntity,
          CouponEntity,
          CouponProductTargetEntity,
          CouponComboTargetEntity,
        ]),
      ],
      controllers: [OrdersController],
      providers: [
        OrdersService,
        StockItemsService,
        { provide: CalculationService, useValue: mockCalcService },
        {
          provide: MailService,
          useValue: {
            sendOrderConfirmedEmail: jest.fn().mockResolvedValue(undefined),
            sendOrderDispatchedEmail: jest.fn().mockResolvedValue(undefined),
            sendOrderCancelledEmail: jest.fn().mockResolvedValue(undefined),
            sendOrderDeliveredEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn() },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { ...mockUser };
          return true;
        },
      })
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

    // Seed: profile → user
    const profileRepo = dataSource.getRepository(ProfileEntity);
    const userRepo = dataSource.getRepository(UserEntity);
    const categoryRepo = dataSource.getRepository(CategoryEntity);
    const productRepo = dataSource.getRepository(ProductEntity);
    const locationRepo = dataSource.getRepository(StockLocationEntity);
    const stockRepo = dataSource.getRepository(StockItemEntity);

    const profile = await profileRepo.save(
      profileRepo.create({ name: 'Test', lastName: 'User' }),
    );
    const user = await userRepo.save(
      userRepo.create({
        email: 'test@e2e.com',
        password: 'password',
        isActive: true,
        profileId: profile.id,
      }),
    );
    userId = user.id;
    mockUser.sub = userId;

    // Seed: category → product
    const category = await categoryRepo.save(
      categoryRepo.create({ name: 'Test Category' }),
    );
    const product = await productRepo.save(
      productRepo.create({
        sku: 'P001',
        name: 'Test Product',
        description: 'E2E test product',
        isActive: true,
        categoryId: category.id,
        measurementUnit: ProductMeasurementUnit.UNIT,
      }),
    );
    productId = product.id;

    // Seed: stock location → stock item (50 units)
    const location = await locationRepo.save(
      locationRepo.create({
        name: 'Almacén Principal',
        type: StockLocationType.WAREHOUSE,
      }),
    );
    await stockRepo.save(
      stockRepo.create({
        productId: product.id,
        locationId: location.id,
        quantityCurrent: 50,
        quantityReserved: 0,
      }),
    );

    // Seed: combo con un ítem que usa el mismo producto
    const comboRepo = dataSource.getRepository(ComboEntity);
    const comboItemRepo = dataSource.getRepository(ComboItemEntity);
    const combo = await comboRepo.save(
      comboRepo.create({
        name: 'Combo Test',
        description: 'E2E test combo',
        isActive: true,
        categoryId: category.id,
      }),
    );
    comboId = combo.id;
    await comboItemRepo.save(
      comboItemRepo.create({
        comboId: combo.id,
        productId: product.id,
        quantity: 1,
      }),
    );

    // Seed: cupón global del 10% sin límite de usos
    const couponRepo = dataSource.getRepository(CouponEntity);
    const coupon = await couponRepo.save(
      couponRepo.create({
        code: 'TESTGLOBAL10',
        value: 10,
        isGlobal: true,
        usageCount: 0,
      }),
    );
    couponCode = coupon.code;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // POST /orders
  // =============================================

  describe('POST /orders', () => {
    it('201 — crea orden con pickup', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.userId).toBe(userId);
      expect(res.body.status).toBe(OrderStatus.PENDING);
      expect(res.body.subtotal).toBe(1000);
      expect(res.body.total).toBe(1000);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].productId).toBe(productId);
      expect(res.body.items[0].unitPrice).toBe(1000);
    });

    it('201 — crea orden con delivery y dirección', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.DELIVERY,
          address: 'Av. Corrientes 1234',
        })
        .expect(201);

      expect(res.body.deliveryType).toBe(DeliveryType.DELIVERY);
      expect(res.body.address).toBe('Av. Corrientes 1234');
    });

    it('400 — body sin items', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({ items: [], deliveryType: DeliveryType.PICKUP })
        .expect(400);
    });

    it('400 — delivery sin dirección', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.DELIVERY,
        })
        .expect(400);
    });

    it('400 — item sin productId ni comboId', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({ items: [{ quantity: 1 }], deliveryType: DeliveryType.PICKUP })
        .expect(400);
    });

    it('404 — producto inexistente', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId: 999999, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        })
        .expect(404);
    });

    it('400 — stock insuficiente', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 999 }],
          deliveryType: DeliveryType.PICKUP,
        })
        .expect(400);
    });

    it('201 — orden con notes persiste el campo', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
          notes: 'Sin cebolla',
        })
        .expect(201);
      expect(res.body.notes).toBe('Sin cebolla');
    });

    it('201 — crea orden con combo', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ comboId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(OrderStatus.PENDING);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].comboId).toBe(comboId);
      expect(res.body.items[0].unitPrice).toBe(2000);
    });

    it('201 — crea orden con cupón global aplica descuento', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
          couponCode,
        })
        .expect(201);

      expect(res.body.couponCode).toBe(couponCode);
      expect(res.body.couponDiscount).toBeGreaterThan(0);
      expect(res.body.total).toBeLessThan(res.body.subtotal);
    });

    it('409 — cupón ya usado por el mismo usuario', async () => {
      // El cupón fue aplicado en el test anterior por el mismo usuario
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
          couponCode,
        })
        .expect(409);
    });

    it('404 — cupón inexistente', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
          couponCode: 'NOEXISTE',
        })
        .expect(404);
    });
  });

  // =============================================
  // GET /orders
  // =============================================

  describe('GET /orders', () => {
    it('200 — retorna lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/orders')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBeDefined();
    });

    it('200 — respeta limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/orders?page=1&limit=1')
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.limit).toBe(1);
    });
  });

  // =============================================
  // GET /orders/user/:userId
  // =============================================

  describe('GET /orders/user/:userId', () => {
    it('200 — retorna órdenes del usuario', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/orders/user/${userId}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].userId).toBe(userId);
    });

    it('403 — cliente accede a órdenes de otro usuario', async () => {
      mockUser.role = RoleType.CLIENT;
      await request(app.getHttpServer())
        .get('/v1/orders/user/999999')
        .expect(403);
      mockUser.role = RoleType.ADMIN;
    });
  });

  // =============================================
  // GET /orders/:id
  // =============================================

  describe('GET /orders/:id', () => {
    let orderId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        });
      orderId = res.body.id;
    });

    it('200 — retorna orden por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/orders/${orderId}`)
        .expect(200);
      expect(res.body.id).toBe(orderId);
      expect(res.body.status).toBe(OrderStatus.PENDING);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('404 — orden inexistente', async () => {
      await request(app.getHttpServer()).get('/v1/orders/999999').expect(404);
    });

    it('403 — cliente accede a orden de otro usuario', async () => {
      mockUser.sub = 999999;
      mockUser.role = RoleType.CLIENT;
      await request(app.getHttpServer())
        .get(`/v1/orders/${orderId}`)
        .expect(403);
      mockUser.sub = userId;
      mockUser.role = RoleType.ADMIN;
    });
  });

  // =============================================
  // PATCH /orders/:id/status
  // =============================================

  describe('PATCH /orders/:id/status', () => {
    let orderId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        });
      orderId = res.body.id;
    });

    it('200 — PENDING → CONFIRMED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(200);
      expect(res.body.status).toBe(OrderStatus.CONFIRMED);
    });

    it('400 — transición inválida CONFIRMED → PENDING', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .send({ status: OrderStatus.PENDING })
        .expect(400);
    });

    it('200 — CONFIRMED → CANCELLED (libera stock)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .send({ status: OrderStatus.CANCELLED })
        .expect(200);
      expect(res.body.status).toBe(OrderStatus.CANCELLED);
    });

    it('400 — transición inválida CANCELLED → CONFIRMED', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(400);
    });

    it('400 — status inválido', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });

    it('404 — orden inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/v1/orders/999999/status')
        .send({ status: OrderStatus.CONFIRMED })
        .expect(404);
    });

    it('200 — camino completo PENDING→CONFIRMED→DISPATCHED→DELIVERED', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        })
        .expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/orders/${id}/status`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/v1/orders/${id}/status`)
        .send({ status: OrderStatus.DISPATCHED })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${id}/status`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(200);

      expect(res.body.status).toBe(OrderStatus.DELIVERED);
    });

    it('400 — transición inválida DELIVERED → CANCELLED', async () => {
      // reusa la orden delivered del test anterior via beforeAll de la suite
      // crea una nueva delivered para aislar
      const createRes = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
          deliveryType: DeliveryType.PICKUP,
        })
        .expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/orders/${id}/status`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/v1/orders/${id}/status`)
        .send({ status: OrderStatus.DISPATCHED })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/v1/orders/${id}/status`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/v1/orders/${id}/status`)
        .send({ status: OrderStatus.CANCELLED })
        .expect(400);
    });
  });
});
