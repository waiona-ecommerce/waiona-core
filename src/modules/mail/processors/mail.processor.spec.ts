import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import { MailProcessor } from './mail.processor';
import {
  MailJobType,
  ActivationJobData,
  PasswordResetJobData,
  OrderEmailJobData,
  OrderCancelledJobData,
  StockAlertJobData,
} from '../mail.constants';

jest.mock('resend');
import { Resend } from 'resend';

const makeJob = <T>(data: T) => ({ data }) as Job<T>;

describe('MailProcessor', () => {
  let processor: MailProcessor;
  let mockSend: jest.Mock;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'RESEND_API_KEY') return 'test-api-key';
      if (key === 'MAIL_FROM') return 'Waiona <test@waiona.com>';
    }),
  };

  beforeEach(async () => {
    mockSend = jest.fn().mockResolvedValue({ id: 'test-email-id' });
    (Resend as jest.Mock).mockImplementation(() => ({
      emails: { send: mockSend },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailProcessor,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    processor = module.get<MailProcessor>(MailProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(processor).toBeDefined());

  // ==========================
  // sendActivation
  // ==========================

  describe(MailJobType.SEND_ACTIVATION, () => {
    it('should call Resend with correct subject and recipient', async () => {
      const job = makeJob<ActivationJobData>({
        to: 'user@test.com',
        name: 'Juan',
        activationUrl: 'http://localhost:4200/auth/activate?token=abc',
      });

      await processor.sendActivation(job);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Activá tu cuenta en Waiona',
          from: 'Waiona <test@waiona.com>',
        }),
      );
    });

    it('should escape HTML in name', async () => {
      const job = makeJob<ActivationJobData>({
        to: 'user@test.com',
        name: '<script>alert(1)</script>',
        activationUrl: 'http://localhost:4200/auth/activate?token=abc',
      });

      await processor.sendActivation(job);

      const html: string = mockSend.mock.calls[0][0].html;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('propagates the error when Resend rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API error'));
      const job = makeJob<ActivationJobData>({
        to: 'user@test.com',
        name: 'Juan',
        activationUrl: 'http://localhost:4200/auth/activate?token=abc',
      });

      await expect(processor.sendActivation(job)).rejects.toThrow(
        'Resend API error',
      );
    });
  });

  // ==========================
  // sendPasswordReset
  // ==========================

  describe(MailJobType.SEND_PASSWORD_RESET, () => {
    it('should call Resend with correct subject and recipient', async () => {
      const job = makeJob<PasswordResetJobData>({
        to: 'user@test.com',
        name: 'Juan',
        resetUrl: 'http://localhost:4200/auth/reset-password?token=xyz',
      });

      await processor.sendPasswordReset(job);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Recuperá tu contraseña en Waiona',
        }),
      );
    });

    it('propagates the error when Resend rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API error'));
      const job = makeJob<PasswordResetJobData>({
        to: 'user@test.com',
        name: 'Juan',
        resetUrl: 'http://localhost:4200/auth/reset-password?token=xyz',
      });

      await expect(processor.sendPasswordReset(job)).rejects.toThrow(
        'Resend API error',
      );
    });
  });

  // ==========================
  // sendOrderConfirmed
  // ==========================

  describe(MailJobType.SEND_ORDER_CONFIRMED, () => {
    it('should call Resend with order id in subject', async () => {
      const job = makeJob<OrderEmailJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
        orderUrl: 'http://localhost:4200/orders/42',
      });

      await processor.sendOrderConfirmed(job);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Pedido #42 confirmado — Waiona',
        }),
      );
    });

    it('propagates the error when Resend rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API error'));
      const job = makeJob<OrderEmailJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
        orderUrl: 'http://localhost:4200/orders/42',
      });

      await expect(processor.sendOrderConfirmed(job)).rejects.toThrow(
        'Resend API error',
      );
    });
  });

  // ==========================
  // sendOrderDispatched
  // ==========================

  describe(MailJobType.SEND_ORDER_DISPATCHED, () => {
    it('should call Resend with order id in subject', async () => {
      const job = makeJob<OrderEmailJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
        orderUrl: 'http://localhost:4200/orders/42',
      });

      await processor.sendOrderDispatched(job);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Tu pedido #42 está en camino — Waiona',
        }),
      );
    });

    it('propagates the error when Resend rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API error'));
      const job = makeJob<OrderEmailJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
        orderUrl: 'http://localhost:4200/orders/42',
      });

      await expect(processor.sendOrderDispatched(job)).rejects.toThrow(
        'Resend API error',
      );
    });
  });

  // ==========================
  // sendOrderCancelled
  // ==========================

  describe(MailJobType.SEND_ORDER_CANCELLED, () => {
    it('should call Resend with order id in subject', async () => {
      const job = makeJob<OrderCancelledJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
      });

      await processor.sendOrderCancelled(job);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Pedido #42 cancelado — Waiona',
        }),
      );
    });

    it('propagates the error when Resend rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API error'));
      const job = makeJob<OrderCancelledJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
      });

      await expect(processor.sendOrderCancelled(job)).rejects.toThrow(
        'Resend API error',
      );
    });
  });

  // ==========================
  // sendOrderDelivered
  // ==========================

  describe(MailJobType.SEND_ORDER_DELIVERED, () => {
    it('should call Resend with review url in subject', async () => {
      const job = makeJob<OrderEmailJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
        orderUrl: 'http://localhost:4200/orders/42/review',
      });

      await processor.sendOrderDelivered(job);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '¿Cómo fue tu experiencia con el pedido #42? — Waiona',
        }),
      );
    });

    it('propagates the error when Resend rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API error'));
      const job = makeJob<OrderEmailJobData>({
        to: 'user@test.com',
        name: 'Ana',
        orderId: 42,
        orderUrl: 'http://localhost:4200/orders/42/review',
      });

      await expect(processor.sendOrderDelivered(job)).rejects.toThrow(
        'Resend API error',
      );
    });
  });

  // ==========================
  // sendStockAlert
  // ==========================

  describe(MailJobType.SEND_STOCK_ALERT, () => {
    it('should call Resend with stock info', async () => {
      const job = makeJob<StockAlertJobData>({
        productName: 'Producto A',
        locationName: 'Depósito 1',
        quantityAvailable: 1,
        threshold: 5,
        adminEmail: 'admin@waiona.com',
      });

      await processor.sendStockAlert(job);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@waiona.com',
          subject: 'Stock crítico: Producto A',
        }),
      );
    });

    it('should escape HTML in productName and locationName', async () => {
      const job = makeJob<StockAlertJobData>({
        productName: 'Producto <B&W>',
        locationName: 'Depósito & Norte',
        quantityAvailable: 1,
        threshold: 5,
        adminEmail: 'admin@waiona.com',
      });

      await processor.sendStockAlert(job);

      const html: string = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Producto &lt;B&amp;W&gt;');
      expect(html).toContain('Depósito &amp; Norte');
      expect(html).not.toContain('<B&W>');
    });

    it('propagates the error when Resend rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API error'));
      const job = makeJob<StockAlertJobData>({
        productName: 'Producto A',
        locationName: 'Depósito 1',
        quantityAvailable: 1,
        threshold: 5,
        adminEmail: 'admin@waiona.com',
      });

      await expect(processor.sendStockAlert(job)).rejects.toThrow(
        'Resend API error',
      );
    });
  });
});
