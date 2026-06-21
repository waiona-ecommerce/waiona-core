import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { MailService } from './mail.service';
import { MAIL_QUEUE, MailJobType } from '../mail.constants';

describe('MailService', () => {
  let service: MailService;
  let mockQueue: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        FRONTEND_URL: 'http://localhost:4200',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken(MAIL_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('sendActivationEmail', () => {
    it('should enqueue SEND_ACTIVATION job with correct data', async () => {
      await service.sendActivationEmail('user@test.com', 'Juan', 'token_abc');

      expect(mockQueue.add).toHaveBeenCalledWith(
        MailJobType.SEND_ACTIVATION,
        expect.objectContaining({
          to: 'user@test.com',
          name: 'Juan',
          activationUrl: 'http://localhost:4200/auth/activate?token=token_abc',
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should enqueue SEND_PASSWORD_RESET job with correct data', async () => {
      await service.sendPasswordResetEmail(
        'user@test.com',
        'Juan',
        'reset_token',
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        MailJobType.SEND_PASSWORD_RESET,
        expect.objectContaining({
          to: 'user@test.com',
          name: 'Juan',
          resetUrl:
            'http://localhost:4200/auth/reset-password?token=reset_token',
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendOrderConfirmedEmail', () => {
    it('should enqueue SEND_ORDER_CONFIRMED job', async () => {
      await service.sendOrderConfirmedEmail('u@t.com', 'Ana', 42);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MailJobType.SEND_ORDER_CONFIRMED,
        expect.objectContaining({ to: 'u@t.com', orderId: 42 }),
        expect.any(Object),
      );
    });
  });

  describe('sendOrderDispatchedEmail', () => {
    it('should enqueue SEND_ORDER_DISPATCHED job with correct data', async () => {
      await service.sendOrderDispatchedEmail('u@t.com', 'Ana', 42);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MailJobType.SEND_ORDER_DISPATCHED,
        expect.objectContaining({
          to: 'u@t.com',
          orderId: 42,
          orderUrl: 'http://localhost:4200/orders/42',
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendOrderDeliveredEmail', () => {
    it('should enqueue SEND_ORDER_DELIVERED job with review URL', async () => {
      await service.sendOrderDeliveredEmail('u@t.com', 'Ana', 42);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MailJobType.SEND_ORDER_DELIVERED,
        expect.objectContaining({
          to: 'u@t.com',
          orderId: 42,
          orderUrl: 'http://localhost:4200/orders/42/review',
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendOrderCancelledEmail', () => {
    it('should enqueue SEND_ORDER_CANCELLED job', async () => {
      await service.sendOrderCancelledEmail('u@t.com', 'Ana', 42);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MailJobType.SEND_ORDER_CANCELLED,
        expect.objectContaining({ to: 'u@t.com', orderId: 42 }),
        expect.any(Object),
      );
    });
  });

  describe('sendStockAlertEmail', () => {
    it('should enqueue SEND_STOCK_ALERT job', async () => {
      await service.sendStockAlertEmail({
        productName: 'Producto A',
        locationName: 'Depósito 1',
        quantityAvailable: 1,
        threshold: 2,
        adminEmail: 'admin@test.com',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        MailJobType.SEND_STOCK_ALERT,
        expect.objectContaining({ productName: 'Producto A' }),
        expect.any(Object),
      );
    });
  });
});
