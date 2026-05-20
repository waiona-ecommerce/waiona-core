import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

import { PaymentsController } from '../../src/modules/payments/controllers/payments.controller';
import { PaymentsService } from '../../src/modules/payments/services/payments.service';
import { MercadoPagoProvider } from '../../src/modules/payments/services/providers/mercadopago.provider';
import { PaymentEntity } from '../../src/modules/payments/entities/payment.entity';
import { PaymentStatus } from '../../src/modules/payments/enums/payment-status.enum';
import { PaymentProvider } from '../../src/modules/payments/enums/payment-provider.enum';

import { OrdersService } from '../../src/modules/orders/services/orders.service';
import { OrderEntity } from '../../src/modules/orders/entities/order.entity';
import { OrderItemEntity } from '../../src/modules/orders/entities/order-item.entity';
import { OrderStatus } from '../../src/modules/orders/enums/order-status.enum';
import { DeliveryType } from '../../src/modules/orders/enums/delivery-type.enum';

import { UserEntity } from '../../src/modules/users/entities/user.entity';
import { ProfileEntity } from '../../src/modules/users/entities/profile.entity';
import { RoleEntity } from '../../src/modules/users/entities/role.entity';

import { ProductEntity } from '../../src/modules/products/product/entities/product.entity';
import { ProductImageEntity } from '../../src/modules/products/product-images/entities/product-image.entity';
import { CategoryEntity } from '../../src/modules/products/categories/entities/category.entity';
import { ComboEntity } from '../../src/modules/products/combos/entities/combo.entity';
import { ComboItemEntity } from '../../src/modules/products/combos/entities/combo-item.entity';
import { ComboImageEntity } from '../../src/modules/products/combo-images/entities/combo-image.entity';

import { StockItemEntity } from '../../src/modules/stocks/stock-item/entities/stock-item.entity';
import { StockLocationEntity } from '../../src/modules/stocks/stock-locations/entities/stock-locations.entity';
import { StockMovementEntity } from '../../src/modules/stocks/stock-movement/entities/stock-movement.entity';
import { StockWriteOffEntity } from '../../src/modules/stocks/stock-writeoff/entities/stock-writeoff.entity';

import { CouponEntity } from '../../src/modules/coupons/coupon/entities/coupon.entity';
import { CouponProductTargetEntity } from '../../src/modules/coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from '../../src/modules/coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { CouponUsageEntity } from '../../src/modules/coupons/usage/entities/coupon-usage.entity';

import { RoleType } from '../../src/common/enums/role-type.enum';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let userId: number;
  let pendingOrderId: number;
  let confirmedOrderId: number;
  let getTestOrderId: number;
  let getTestPaymentId: number;

  const mockUser: { sub: number; role: string } = { sub: 0, role: RoleType.ADMIN };

  const mockMpProvider = {
    createPreference: jest.fn().mockResolvedValue({
      id: 'pref_test_123',
      checkoutUrl: 'https://mp.com/checkout/test',
    }),
    getClient: jest.fn().mockReturnValue({}),
  };

  const mockOrdersService = {
    releaseStockForOrder: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type:     'postgres',
            host:     config.get('POSTGRES_HOST'),
            port:     parseInt(config.get('POSTGRES_TEST_PORT') || '5433'),
            username: config.get('POSTGRES_USER'),
            password: config.get('POSTGRES_PASSWORD'),
            database: config.get('POSTGRES_TEST_DB'),
            entities: [
              PaymentEntity,
              OrderEntity, OrderItemEntity,
              UserEntity, ProfileEntity, RoleEntity,
              ProductEntity, CategoryEntity, ProductImageEntity,
              ComboEntity, ComboItemEntity, ComboImageEntity,
              StockItemEntity, StockLocationEntity, StockMovementEntity, StockWriteOffEntity,
              CouponEntity, CouponProductTargetEntity, CouponComboTargetEntity, CouponUsageEntity,
            ],
            synchronize: true,
            dropSchema:  true,
          }),
        }),
        TypeOrmModule.forFeature([PaymentEntity, OrderEntity]),
      ],
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        { provide: MercadoPagoProvider, useValue: mockMpProvider     },
        { provide: OrdersService,       useValue: mockOrdersService   },
      ],
    })
      .overrideGuard(AuthGuard('jwt')).useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { ...mockUser };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
    }));

    await app.init();
    dataSource = moduleFixture.get(DataSource);

    // Seed: profile → usuario
    const profileRepo = dataSource.getRepository(ProfileEntity);
    const userRepo    = dataSource.getRepository(UserEntity);
    const orderRepo   = dataSource.getRepository(OrderEntity);
    const paymentRepo = dataSource.getRepository(PaymentEntity);

    const profile = await profileRepo.save(profileRepo.create({ name: 'Test', lastName: 'User' }));
    const user    = await userRepo.save(userRepo.create({
      email: 'test@payments.com', password: 'password', isActive: true, profileId: profile.id,
    }));
    userId        = user.id;
    mockUser.sub  = userId;

    // Orden PENDING — para tests de POST /payments
    const pendingOrder = await orderRepo.save(orderRepo.create({
      userId, status: OrderStatus.PENDING, deliveryType: DeliveryType.PICKUP,
      subtotal: 1000, total: 1000,
    }));
    pendingOrderId = pendingOrder.id;

    // Orden CONFIRMED — para test "400 orden no pagable"
    const confirmedOrder = await orderRepo.save(orderRepo.create({
      userId, status: OrderStatus.CONFIRMED, deliveryType: DeliveryType.PICKUP,
      subtotal: 1000, total: 1000,
    }));
    confirmedOrderId = confirmedOrder.id;

    // Orden + pago ya existente — para tests de GET
    const getTestOrder = await orderRepo.save(orderRepo.create({
      userId, status: OrderStatus.PENDING, deliveryType: DeliveryType.PICKUP,
      subtotal: 2000, total: 2000,
    }));
    getTestOrderId = getTestOrder.id;

    const getTestPayment = await paymentRepo.save(paymentRepo.create({
      orderId:     getTestOrderId,
      provider:    PaymentProvider.MERCADOPAGO,
      status:      PaymentStatus.PENDING,
      externalId:  'pref_seed_123',
      checkoutUrl: 'https://mp.com/checkout/seed',
      amount:      2000,
    }));
    getTestPaymentId = getTestPayment.id;
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // POST /payments
  // =============================================

  describe('POST /payments', () => {
    it('201 — crea pago con MercadoPago para orden pendiente', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .send({ orderId: pendingOrderId, provider: PaymentProvider.MERCADOPAGO })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.orderId).toBe(pendingOrderId);
      expect(res.body.status).toBe(PaymentStatus.PENDING);
      expect(res.body.provider).toBe(PaymentProvider.MERCADOPAGO);
      expect(res.body.checkoutUrl).toBe('https://mp.com/checkout/test');
      expect(res.body.amount).toBe(1000);
    });

    it('400 — orden ya tiene un pago pendiente', async () => {
      // pendingOrderId ya tiene el pago del test anterior
      await request(app.getHttpServer())
        .post('/payments')
        .send({ orderId: pendingOrderId, provider: PaymentProvider.MERCADOPAGO })
        .expect(400);
    });

    it('400 — orden no está en estado PENDING', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ orderId: confirmedOrderId, provider: PaymentProvider.MERCADOPAGO })
        .expect(400);
    });

    it('403 — cliente intenta pagar orden de otro usuario', async () => {
      mockUser.role = RoleType.CLIENT;
      mockUser.sub  = 999999;
      await request(app.getHttpServer())
        .post('/payments')
        .send({ orderId: pendingOrderId, provider: PaymentProvider.MERCADOPAGO })
        .expect(403);
      mockUser.role = RoleType.ADMIN;
      mockUser.sub  = userId;
    });

    it('404 — orden no encontrada', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ orderId: 999999, provider: PaymentProvider.MERCADOPAGO })
        .expect(404);
    });

    it('400 — body inválido (sin provider)', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ orderId: pendingOrderId })
        .expect(400);
    });
  });

  // =============================================
  // POST /payments/webhook/mercadopago
  // =============================================

  describe('POST /payments/webhook/mercadopago', () => {
    it('200 — siempre retorna 200 (sin id en query)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/webhook/mercadopago')
        .send({})
        .expect(200);
      expect(res.body.received).toBe(true);
    });

    it('200 — siempre retorna 200 (topic desconocido)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/webhook/mercadopago')
        .query({ id: '1', topic: 'other' })
        .send({})
        .expect(200);
      expect(res.body.received).toBe(true);
    });

    it('200 — swallow error cuando topic=merchant_order y MP API falla', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/webhook/mercadopago')
        .query({ id: '1', topic: 'merchant_order' })
        .send({})
        .expect(200);
      expect(res.body.received).toBe(true);
    });

    it('200 — swallow error cuando topic=payment y MP API falla', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/webhook/mercadopago')
        .query({ id: '1', topic: 'payment' })
        .send({})
        .expect(200);
      expect(res.body.received).toBe(true);
    });
  });

  // =============================================
  // GET /payments/order/:orderId
  // =============================================

  describe('GET /payments/order/:orderId', () => {
    it('200 — admin ve los pagos de una orden', async () => {
      const res = await request(app.getHttpServer())
        .get(`/payments/order/${getTestOrderId}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].orderId).toBe(getTestOrderId);
    });

    it('200 — cliente ve los pagos de su propia orden', async () => {
      mockUser.role = RoleType.CLIENT;
      const res = await request(app.getHttpServer())
        .get(`/payments/order/${getTestOrderId}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      mockUser.role = RoleType.ADMIN;
    });

    it('403 — cliente accede a pagos de orden de otro usuario', async () => {
      mockUser.role = RoleType.CLIENT;
      mockUser.sub  = 999999;
      await request(app.getHttpServer())
        .get(`/payments/order/${getTestOrderId}`)
        .expect(403);
      mockUser.role = RoleType.ADMIN;
      mockUser.sub  = userId;
    });

    it('200 — admin accede a orderId inexistente → array vacío (sin 404)', async () => {
      const res = await request(app.getHttpServer())
        .get('/payments/order/999999')
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('404 — orden no encontrada (path de cliente)', async () => {
      mockUser.role = RoleType.CLIENT;
      await request(app.getHttpServer())
        .get('/payments/order/999999')
        .expect(404);
      mockUser.role = RoleType.ADMIN;
    });
  });

  // =============================================
  // GET /payments/:id
  // =============================================

  describe('GET /payments/:id', () => {
    it('200 — admin obtiene pago por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/payments/${getTestPaymentId}`)
        .expect(200);
      expect(res.body.id).toBe(getTestPaymentId);
      expect(res.body.status).toBe(PaymentStatus.PENDING);
      expect(res.body.orderId).toBe(getTestOrderId);
    });

    it('200 — cliente ve su propio pago', async () => {
      mockUser.role = RoleType.CLIENT;
      const res = await request(app.getHttpServer())
        .get(`/payments/${getTestPaymentId}`)
        .expect(200);
      expect(res.body.id).toBe(getTestPaymentId);
      mockUser.role = RoleType.ADMIN;
    });

    it('403 — cliente accede a pago de otro usuario', async () => {
      mockUser.role = RoleType.CLIENT;
      mockUser.sub  = 999999;
      await request(app.getHttpServer())
        .get(`/payments/${getTestPaymentId}`)
        .expect(403);
      mockUser.role = RoleType.ADMIN;
      mockUser.sub  = userId;
    });

    it('404 — pago no encontrado', async () => {
      await request(app.getHttpServer())
        .get('/payments/999999')
        .expect(404);
    });
  });
});
