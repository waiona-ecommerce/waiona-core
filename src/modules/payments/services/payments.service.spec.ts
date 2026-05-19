import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

import { PaymentsService } from './payments.service';
import { PaymentEntity } from '../entities/payment.entity';
import { OrderEntity } from 'src/modules/orders/entities/order.entity';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { OrdersService } from 'src/modules/orders/services/orders.service';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { OrderStatus } from 'src/modules/orders/enums/order-status.enum';
import { RoleType } from 'src/common/enums/role-type.enum';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPaymentRepo   = () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() });
  const mockOrderRepo     = () => ({ find: jest.fn(), findOne: jest.fn(), save: jest.fn() });
  const mockMpProvider    = () => ({ createPreference: jest.fn(), getClient: jest.fn() });
  const mockOrdersService = () => ({ releaseStockForOrder: jest.fn() });

  const mockOrder = (overrides: any = {}): OrderEntity =>
    ({ id: 1, status: OrderStatus.PENDING, total: 653.4, isDeleted: false,
       items: [], createdAt: new Date(), updatedAt: new Date(), ...overrides }) as unknown as OrderEntity;

  const mockPayment = (overrides: any = {}): PaymentEntity =>
    ({ id: 1, orderId: 1, provider: PaymentProvider.MERCADOPAGO, status: PaymentStatus.PENDING,
       externalId: 'pref_123', checkoutUrl: 'https://mp.com/checkout', amount: 653.4,
       isDeleted: false, createdAt: new Date(), updatedAt: new Date(), ...overrides }) as unknown as PaymentEntity;

  // manager usado dentro de dataSource.transaction en create()
  const mockTxManager = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockDataSource = { transaction: jest.fn(cb => cb(mockTxManager)) };

  let paymentRepo: any;
  let orderRepo: any;
  let mpProvider: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(PaymentEntity), useFactory: mockPaymentRepo   },
        { provide: getRepositoryToken(OrderEntity),   useFactory: mockOrderRepo     },
        { provide: MercadoPagoProvider,               useFactory: mockMpProvider    },
        { provide: OrdersService,                     useFactory: mockOrdersService },
        { provide: getDataSourceToken(),              useValue: mockDataSource      },
      ],
    }).compile();

    service     = module.get<PaymentsService>(PaymentsService);
    paymentRepo = module.get(getRepositoryToken(PaymentEntity));
    orderRepo   = module.get(getRepositoryToken(OrderEntity));
    mpProvider  = module.get(MercadoPagoProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    Object.values(mockTxManager).forEach(fn => (fn as jest.Mock).mockReset?.());
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const userId = 99;
    const role   = RoleType.CLIENT;
    const dto    = { orderId: 1, provider: PaymentProvider.MERCADOPAGO };

    it('should create a payment with MercadoPago preference', async () => {
      const payment = mockPayment();
      // create() usa el patrón de dos queries: 1→ lock-only, 2→ full load, 3→ check pago existente
      mockTxManager.findOne
        .mockResolvedValueOnce(mockOrder({ userId }))                 // lock
        .mockResolvedValueOnce(mockOrder({ userId }))                 // full load
        .mockResolvedValueOnce(null);                                 // no existing payment
      mpProvider.createPreference.mockResolvedValue({ id: 'pref_123', checkoutUrl: 'https://mp.com/checkout' });
      mockTxManager.create.mockReturnValue(payment);
      mockTxManager.save.mockResolvedValue(payment);

      const result = await service.create(userId, role, dto as any);

      expect(mpProvider.createPreference).toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.checkoutUrl).toBe('https://mp.com/checkout');
    });

    it('should throw NotFoundException if order not found', async () => {
      mockTxManager.findOne.mockResolvedValueOnce(null); // lock returns null → 404
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order is not PENDING', async () => {
      const confirmed = mockOrder({ userId, status: OrderStatus.CONFIRMED });
      mockTxManager.findOne
        .mockResolvedValueOnce(confirmed) // lock
        .mockResolvedValueOnce(confirmed); // full load
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if client accesses another user order', async () => {
      const order = mockOrder({ userId: 1 }); // different from userId=99
      mockTxManager.findOne
        .mockResolvedValueOnce(order) // lock
        .mockResolvedValueOnce(order); // full load
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order already has a pending payment', async () => {
      const order = mockOrder({ userId });
      mockTxManager.findOne
        .mockResolvedValueOnce(order)         // lock
        .mockResolvedValueOnce(order)         // full load
        .mockResolvedValueOnce(mockPayment()); // existing pending payment
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================
  // handleMercadoPagoWebhook
  // ==========================

  describe('handleMercadoPagoWebhook', () => {
    const mockMerchantOrderGet = jest.fn();

    beforeEach(() => {
      jest.mock('mercadopago', () => ({
        MerchantOrder: jest.fn().mockImplementation(() => ({
          get: mockMerchantOrderGet,
        })),
      }));
    });

    it('should return early if no id in query or body', async () => {
      await service.handleMercadoPagoWebhook({}, {});
      expect(paymentRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return early if topic is not payment or merchant_order', async () => {
      await service.handleMercadoPagoWebhook({}, { id: '1', topic: 'other' });
      expect(paymentRepo.findOne).not.toHaveBeenCalled();
    });

    it('should swallow errors silently', async () => {
      mpProvider.getClient.mockReturnValue({});
      // MerchantOrder.get va a fallar porque está mockeado globalmente
      // el service debe tragarse el error sin tirar
      await expect(
        service.handleMercadoPagoWebhook({}, { id: '1', topic: 'payment' }),
      ).resolves.not.toThrow();
    });
  });

  // ==========================
  // findByOrder
  // ==========================

  describe('findByOrder', () => {
    it('should return payments by orderId for admin', async () => {
      paymentRepo.find.mockResolvedValue([mockPayment()]);
      const result = await service.findByOrder(1, 99, RoleType.ADMIN);
      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe(1);
    });

    it('should return empty array if no payments', async () => {
      paymentRepo.find.mockResolvedValue([]);
      const result = await service.findByOrder(999, 99, RoleType.ADMIN);
      expect(result).toEqual([]);
    });

    it('should return payments for client accessing own order', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder({ userId: 99 }));
      paymentRepo.find.mockResolvedValue([mockPayment()]);
      const result = await service.findByOrder(1, 99, RoleType.CLIENT);
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if order not found (client)', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.findByOrder(999, 99, RoleType.CLIENT)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if client accesses another user order', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder({ userId: 1 }));
      await expect(service.findByOrder(1, 99, RoleType.CLIENT)).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a payment by id for admin', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment());
      const result = await service.findOne(1, 99, RoleType.ADMIN);
      expect(result.id).toBe(1);
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('should throw NotFoundException if not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 99, RoleType.ADMIN)).rejects.toThrow(NotFoundException);
    });

    it('should return payment for client accessing own order', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment({ order: { userId: 99 } }));
      const result = await service.findOne(1, 99, RoleType.CLIENT);
      expect(result.id).toBe(1);
    });

    it('should throw ForbiddenException if client accesses another user payment', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment({ order: { userId: 1 } }));
      await expect(service.findOne(1, 99, RoleType.CLIENT)).rejects.toThrow(ForbiddenException);
    });
  });
});