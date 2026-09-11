import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { MerchantOrder, Payment } from 'mercadopago';

import { PaymentsService } from './payments.service';
import { PaymentEntity } from '../entities/payment.entity';
import { OrderEntity } from '../../orders/entities/order.entity';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { OrdersService } from '../../orders/services/orders.service';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { RoleType } from '../../../common/enums/role-type.enum';

jest.mock('mercadopago', () => ({
  MerchantOrder: jest.fn(),
  Payment: jest.fn(),
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn(),
}));

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPaymentRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  });
  const mockOrderRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  });
  const mockMpProvider = () => ({
    createPreference: jest.fn(),
    getClient: jest.fn(),
  });
  const mockOrdersService = () => ({ releaseStockForOrder: jest.fn() });

  const mockOrder = (overrides: any = {}): OrderEntity => ({
    id: 1,
    status: OrderStatus.PENDING,
    total: 653.4,
    isDeleted: false,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockPayment = (overrides: any = {}): PaymentEntity => ({
    id: 1,
    orderId: 1,
    provider: PaymentProvider.MERCADOPAGO,
    status: PaymentStatus.PENDING,
    externalId: 'pref_123',
    checkoutUrl: 'https://mp.com/checkout',
    amount: 653.4,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // manager usado dentro de dataSource.transaction en create()
  const mockTxManager = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockDataSource = { transaction: jest.fn((cb) => cb(mockTxManager)) };

  let paymentRepo: any;
  let orderRepo: any;
  let mpProvider: any;
  let ordersService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(PaymentEntity),
          useFactory: mockPaymentRepo,
        },
        { provide: getRepositoryToken(OrderEntity), useFactory: mockOrderRepo },
        { provide: MercadoPagoProvider, useFactory: mockMpProvider },
        { provide: OrdersService, useFactory: mockOrdersService },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepo = module.get(getRepositoryToken(PaymentEntity));
    orderRepo = module.get(getRepositoryToken(OrderEntity));
    mpProvider = module.get(MercadoPagoProvider);
    ordersService = module.get(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    Object.values(mockTxManager).forEach((fn) => fn.mockReset?.());
  });

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    const userId = 99;
    const role = RoleType.CLIENT;
    const dto = { orderId: 1, provider: PaymentProvider.MERCADOPAGO };

    it('should create a payment with MercadoPago preference without holding the order lock during the MP call', async () => {
      const reserved = mockPayment({ externalId: null, checkoutUrl: null });
      const finalized = mockPayment();
      mockTxManager.findOne
        .mockResolvedValueOnce(mockOrder({ userId })) // order con lock
        .mockResolvedValueOnce(null); // no existing pending payment
      mockTxManager.create.mockReturnValue(reserved);
      mockTxManager.save.mockResolvedValue(reserved);
      mpProvider.createPreference.mockResolvedValue({
        id: 'pref_123',
        checkoutUrl: 'https://mp.com/checkout',
      });
      paymentRepo.save.mockResolvedValue(finalized);

      const result = await service.create(userId, role, dto);

      // la preferencia se pide DESPUÉS de que la transacción (y su lock) ya cerró
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mpProvider.createPreference).toHaveBeenCalled();
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: 'pref_123',
          checkoutUrl: 'https://mp.com/checkout',
        }),
      );
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.checkoutUrl).toBe('https://mp.com/checkout');
    });

    it('should reject a provider without a real integration before touching the DB', async () => {
      await expect(
        service.create(userId, role, {
          orderId: 1,
          provider: PaymentProvider.STRIPE,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mpProvider.createPreference).not.toHaveBeenCalled();
    });

    it('should mark the reserved payment REJECTED and rethrow if the MercadoPago call fails', async () => {
      const reserved = mockPayment({
        id: 7,
        externalId: null,
        checkoutUrl: null,
      });
      mockTxManager.findOne
        .mockResolvedValueOnce(mockOrder({ userId }))
        .mockResolvedValueOnce(null);
      mockTxManager.create.mockReturnValue(reserved);
      mockTxManager.save.mockResolvedValue(reserved);
      mpProvider.createPreference.mockRejectedValue(new Error('MP down'));
      paymentRepo.update.mockResolvedValue(undefined);

      await expect(service.create(userId, role, dto)).rejects.toThrow(
        'MP down',
      );

      expect(paymentRepo.update).toHaveBeenCalledWith(reserved.id, {
        status: PaymentStatus.REJECTED,
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      mockTxManager.findOne.mockResolvedValueOnce(null);
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if order is not PENDING', async () => {
      const confirmed = mockOrder({ userId, status: OrderStatus.CONFIRMED });
      mockTxManager.findOne.mockResolvedValueOnce(confirmed);
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if client accesses another user order', async () => {
      const order = mockOrder({ userId: 1 }); // different from userId=99
      mockTxManager.findOne.mockResolvedValueOnce(order);
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if order already has a pending payment', async () => {
      const order = mockOrder({ userId });
      mockTxManager.findOne
        .mockResolvedValueOnce(order) // order con lock
        .mockResolvedValueOnce(mockPayment()); // existing pending payment
      await expect(service.create(userId, role, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==========================
  // handleMercadoPagoWebhook
  // ==========================

  describe('handleMercadoPagoWebhook', () => {
    // Prepara el transaction mock para devolver un payment + order a manager.findOne
    const setupTx = (paymentOverrides: any = {}, orderOverrides: any = {}) => {
      mockTxManager.findOne
        .mockResolvedValueOnce(mockPayment(paymentOverrides))
        .mockResolvedValueOnce(
          mockOrder({
            userId: 1,
            status: OrderStatus.PENDING,
            ...orderOverrides,
          }),
        );
      mockTxManager.save.mockResolvedValue(undefined);
    };

    beforeEach(() => {
      mpProvider.getClient.mockReturnValue({});
    });

    afterEach(() => {
      (MerchantOrder as jest.Mock).mockReset();
      (Payment as jest.Mock).mockReset();
    });

    it('should return early if no id in query or body', async () => {
      await service.handleMercadoPagoWebhook({}, {});
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should return early if topic is not payment or merchant_order', async () => {
      await service.handleMercadoPagoWebhook({}, { id: '1', topic: 'other' });
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should swallow errors silently', async () => {
      (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
        get: jest.fn().mockRejectedValue(new Error('MP API down')),
      }));
      await expect(
        service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'merchant_order' },
        ),
      ).resolves.not.toThrow();
    });

    it('should skip DB update when externalReference is missing', async () => {
      (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
        get: jest.fn().mockResolvedValue({
          order_status: 'paid',
          external_reference: null,
        }),
      }));
      await service.handleMercadoPagoWebhook(
        {},
        { id: '1', topic: 'merchant_order' },
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    // ── conflictos con pagos ya resueltos ───────────────────────────────────

    describe('payment already resolved (not PENDING)', () => {
      it('should flag for manual review when MP reports paid but payment is already CANCELLED', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest
            .fn()
            .mockResolvedValue({ status: 'approved', external_reference: '1' }),
        }));
        mockTxManager.findOne.mockResolvedValueOnce(
          mockPayment({ status: PaymentStatus.CANCELLED }),
        );

        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );

        // Solo hace un findOne (el pago) — nunca llega a buscar la orden
        expect(mockTxManager.findOne).toHaveBeenCalledTimes(1);
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: PaymentStatus.CANCELLED,
            metadata: expect.objectContaining({ requiresManualReview: true }),
          }),
        );
        expect(ordersService.releaseStockForOrder).not.toHaveBeenCalled();
      });

      it('should be a no-op for a duplicate notification on an already APPROVED payment', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest
            .fn()
            .mockResolvedValue({ status: 'approved', external_reference: '1' }),
        }));
        mockTxManager.findOne.mockResolvedValueOnce(
          mockPayment({ status: PaymentStatus.APPROVED }),
        );

        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );

        expect(mockTxManager.findOne).toHaveBeenCalledTimes(1);
        expect(mockTxManager.save).not.toHaveBeenCalled();
      });

      it('should be a no-op for a duplicate failure notification on an already CANCELLED payment', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest
            .fn()
            .mockResolvedValue({ status: 'refunded', external_reference: '1' }),
        }));
        mockTxManager.findOne.mockResolvedValueOnce(
          mockPayment({ status: PaymentStatus.CANCELLED }),
        );

        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );

        expect(mockTxManager.findOne).toHaveBeenCalledTimes(1);
        expect(mockTxManager.save).not.toHaveBeenCalled();
      });
    });

    // ── selección del pago correcto entre varios intentos de la orden ──────

    describe('preferenceId — no pisar un intento de pago distinto al notificado', () => {
      it('merchant_order: filtra por preference_id, no solo por orderId', async () => {
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            order_status: 'paid',
            external_reference: '1',
            preference_id: 'pref_OLD',
          }),
        }));
        setupTx();

        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'merchant_order' },
        );

        expect(mockTxManager.findOne).toHaveBeenNthCalledWith(
          1,
          PaymentEntity,
          expect.objectContaining({
            where: { orderId: 1, externalId: 'pref_OLD' },
          }),
        );
      });

      it('payment: resuelve preference_id vía la merchant_order asociada y filtra por ella', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            status: 'approved',
            external_reference: '1',
            order: { id: 555 },
          }),
        }));
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({ preference_id: 'pref_OLD' }),
        }));
        setupTx();

        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );

        expect(mockTxManager.findOne).toHaveBeenNthCalledWith(
          1,
          PaymentEntity,
          expect.objectContaining({
            where: { orderId: 1, externalId: 'pref_OLD' },
          }),
        );
      });

      it('payment: si no puede resolver preference_id, cae al fallback por orderId sin perder la notificación', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            status: 'approved',
            external_reference: '1',
            order: { id: 555 },
          }),
        }));
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockRejectedValue(new Error('MP API down')),
        }));
        setupTx();

        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );

        expect(mockTxManager.findOne).toHaveBeenNthCalledWith(
          1,
          PaymentEntity,
          expect.objectContaining({ where: { orderId: 1 } }),
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.APPROVED }),
        );
      });
    });

    // ── merchant_order topic ────────────────────────────────────────────────

    describe('merchant_order — status mapping', () => {
      it('paid → APPROVED payment, CONFIRMED order', async () => {
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            order_status: 'paid',
            external_reference: '1',
          }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'merchant_order' },
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.APPROVED }),
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: OrderStatus.CONFIRMED }),
        );
      });

      it('reverted → CANCELLED payment, CANCELLED order', async () => {
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            order_status: 'reverted',
            external_reference: '1',
          }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'merchant_order' },
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.CANCELLED }),
        );
        expect(mockTxManager.save).toHaveBeenCalledTimes(2); // order + payment
      });

      it('charged_back → CANCELLED payment, CANCELLED order', async () => {
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            order_status: 'charged_back',
            external_reference: '1',
          }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'merchant_order' },
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.CANCELLED }),
        );
        expect(mockTxManager.save).toHaveBeenCalledTimes(2);
      });

      it('payment_in_process → PENDING payment, order unchanged', async () => {
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            order_status: 'payment_in_process',
            external_reference: '1',
          }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'merchant_order' },
        );
        expect(mockTxManager.save).toHaveBeenCalledTimes(1); // solo payment
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.PENDING }),
        );
      });

      it('expired → REJECTED payment, CANCELLED order', async () => {
        (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            order_status: 'expired',
            external_reference: '1',
          }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'merchant_order' },
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.REJECTED }),
        );
        expect(mockTxManager.save).toHaveBeenCalledTimes(2);
      });
    });

    // ── payment topic ───────────────────────────────────────────────────────

    describe('payment topic — status mapping', () => {
      it('approved → APPROVED payment, CONFIRMED order', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest
            .fn()
            .mockResolvedValue({ status: 'approved', external_reference: '1' }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.APPROVED }),
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: OrderStatus.CONFIRMED }),
        );
      });

      it('refunded → CANCELLED payment, CANCELLED order', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest
            .fn()
            .mockResolvedValue({ status: 'refunded', external_reference: '1' }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.CANCELLED }),
        );
        expect(mockTxManager.save).toHaveBeenCalledTimes(2);
      });

      it('in_process → PENDING payment, order unchanged', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({
            status: 'in_process',
            external_reference: '1',
          }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );
        expect(mockTxManager.save).toHaveBeenCalledTimes(1);
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.PENDING }),
        );
      });

      it('rejected → REJECTED payment, CANCELLED order', async () => {
        (Payment as jest.Mock).mockImplementationOnce(() => ({
          get: jest
            .fn()
            .mockResolvedValue({ status: 'rejected', external_reference: '1' }),
        }));
        setupTx();
        await service.handleMercadoPagoWebhook(
          {},
          { id: '1', topic: 'payment' },
        );
        expect(mockTxManager.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: PaymentStatus.REJECTED }),
        );
        expect(mockTxManager.save).toHaveBeenCalledTimes(2);
      });
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
      await expect(
        service.findByOrder(999, 99, RoleType.CLIENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if client accesses another user order', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder({ userId: 1 }));
      await expect(service.findByOrder(1, 99, RoleType.CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
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
      await expect(service.findOne(999, 99, RoleType.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return payment for client accessing own order', async () => {
      paymentRepo.findOne.mockResolvedValue(
        mockPayment({ order: { userId: 99 } }),
      );
      const result = await service.findOne(1, 99, RoleType.CLIENT);
      expect(result.id).toBe(1);
    });

    it('should throw ForbiddenException if client accesses another user payment', async () => {
      paymentRepo.findOne.mockResolvedValue(
        mockPayment({ order: { userId: 1 } }),
      );
      await expect(service.findOne(1, 99, RoleType.CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
