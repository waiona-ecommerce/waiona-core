import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from '../services/payments.service';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { RoleType } from 'src/common/enums/role-type.enum';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: jest.Mocked<PaymentsService>;
  let configGetMock: jest.Mock;

  const mockService = () => ({
    create: jest.fn(),
    handleMercadoPagoWebhook: jest.fn(),
    findByOrder: jest.fn(),
    findOne: jest.fn(),
  });
  const mockAuthGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = (overrides = {}) => ({
    id: 1,
    orderId: 1,
    provider: PaymentProvider.MERCADOPAGO,
    status: PaymentStatus.PENDING,
    externalId: 'pref_123',
    checkoutUrl: 'https://mp.com/checkout',
    amount: 653.4,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    configGetMock = jest.fn().mockReturnValue(''); // sin secret por defecto

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useFactory: mockService },
        { provide: ConfigService, useValue: { get: configGetMock } },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // create
  // ==========================

  describe('create', () => {
    it('should create a payment', async () => {
      service.create.mockResolvedValue(mockResponse());
      const dto = { orderId: 1, provider: PaymentProvider.MERCADOPAGO };
      const req = { user: { sub: 99, role: RoleType.CLIENT } } as any;
      const result = await controller.create(req, dto);
      expect(service.create).toHaveBeenCalledWith(99, RoleType.CLIENT, dto);
      expect(result.checkoutUrl).toBe('https://mp.com/checkout');
    });
  });

  // ==========================
  // webhook
  // ==========================

  describe('handleMercadoPagoWebhook', () => {
    it('should return received: true', async () => {
      service.handleMercadoPagoWebhook.mockResolvedValue(undefined);
      const result = await controller.handleMercadoPagoWebhook({}, {}, {});
      expect(result).toEqual({ received: true });
    });

    it('should skip signature check if MP_WEBHOOK_SECRET is empty', async () => {
      configGetMock.mockReturnValue(''); // sin secret
      service.handleMercadoPagoWebhook.mockResolvedValue(undefined);
      await expect(
        controller.handleMercadoPagoWebhook({}, {}, {}),
      ).resolves.not.toThrow();
    });

    it('should throw UnauthorizedException if secret set but headers missing', async () => {
      configGetMock.mockReturnValue('my_secret');
      service.handleMercadoPagoWebhook.mockResolvedValue(undefined);
      await expect(
        controller.handleMercadoPagoWebhook({}, {}, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should validate correct MP signature', async () => {
      const secret = 'my_secret';
      const ts = '1234567890';
      const requestId = 'req-abc';
      const dataId = '999';
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const v1 = createHmac('sha256', secret).update(manifest).digest('hex');

      configGetMock.mockReturnValue(secret);
      service.handleMercadoPagoWebhook.mockResolvedValue(undefined);

      const headers = {
        'x-signature': `ts=${ts},v1=${v1}`,
        'x-request-id': requestId,
      };

      await expect(
        controller.handleMercadoPagoWebhook({}, { id: dataId }, headers),
      ).resolves.not.toThrow();
    });
  });

  // ==========================
  // findByOrder
  // ==========================

  describe('findByOrder', () => {
    it('should return payments by orderId', async () => {
      service.findByOrder.mockResolvedValue([mockResponse()]);
      const req = { user: { sub: 99, role: RoleType.ADMIN } } as any;
      const result = await controller.findByOrder(1, req);
      expect(service.findByOrder).toHaveBeenCalledWith(1, 99, RoleType.ADMIN);
      expect(result).toHaveLength(1);
    });
  });

  // ==========================
  // findOne
  // ==========================

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      service.findOne.mockResolvedValue(mockResponse());
      const req = { user: { sub: 99, role: RoleType.ADMIN } } as any;
      const result = await controller.findOne(1, req);
      expect(service.findOne).toHaveBeenCalledWith(1, 99, RoleType.ADMIN);
      expect(result.id).toBe(1);
    });
  });
});
