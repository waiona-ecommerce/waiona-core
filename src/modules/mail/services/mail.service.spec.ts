import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

// Mock de Resend
const mockResendSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

describe('MailService', () => {
  let service: MailService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        RESEND_API_KEY: 're_test_key',
        MAIL_FROM: 'Waiona <onboarding@resend.dev>',
        FRONTEND_URL: 'http://localhost:4200',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ==========================
  // sendActivationEmail
  // ==========================

  describe('sendActivationEmail', () => {
    it('should send an activation email with correct params', async () => {
      mockResendSend.mockResolvedValue({ id: 'email_123' });

      await service.sendActivationEmail('user@test.com', 'Juan', 'token_abc');

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Waiona <onboarding@resend.dev>',
          to: 'user@test.com',
          subject: 'Activá tu cuenta en Waiona',
        }),
      );
    });

    it('should include the activation URL in the html', async () => {
      mockResendSend.mockResolvedValue({ id: 'email_123' });

      await service.sendActivationEmail('user@test.com', 'Juan', 'token_abc');

      const call = mockResendSend.mock.calls[0][0];
      expect(call.html).toContain(
        'http://localhost:4200/auth/activate?token=token_abc',
      );
    });

    it('should include the user name in the html', async () => {
      mockResendSend.mockResolvedValue({ id: 'email_123' });

      await service.sendActivationEmail('user@test.com', 'Juan', 'token_abc');

      const call = mockResendSend.mock.calls[0][0];
      expect(call.html).toContain('Juan');
    });

    it('should throw if Resend fails', async () => {
      mockResendSend.mockRejectedValue(new Error('Resend error'));

      await expect(
        service.sendActivationEmail('user@test.com', 'Juan', 'token_abc'),
      ).rejects.toThrow('Resend error');
    });
  });

  // ==========================
  // sendPasswordResetEmail
  // ==========================

  describe('sendPasswordResetEmail', () => {
    it('should send a reset email with correct params', async () => {
      mockResendSend.mockResolvedValue({ id: 'email_456' });

      await service.sendPasswordResetEmail(
        'user@test.com',
        'Juan',
        'reset_token',
      );

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Waiona <onboarding@resend.dev>',
          to: 'user@test.com',
          subject: 'Recuperá tu contraseña en Waiona',
        }),
      );
    });

    it('should include the reset URL in the html', async () => {
      mockResendSend.mockResolvedValue({ id: 'email_456' });

      await service.sendPasswordResetEmail(
        'user@test.com',
        'Juan',
        'reset_token',
      );

      const call = mockResendSend.mock.calls[0][0];
      expect(call.html).toContain(
        'http://localhost:4200/auth/reset-password?token=reset_token',
      );
    });

    it('should include the user name in the html', async () => {
      mockResendSend.mockResolvedValue({ id: 'email_456' });

      await service.sendPasswordResetEmail(
        'user@test.com',
        'Juan',
        'reset_token',
      );

      const call = mockResendSend.mock.calls[0][0];
      expect(call.html).toContain('Juan');
    });

    it('should throw if Resend fails', async () => {
      mockResendSend.mockRejectedValue(new Error('Resend error'));

      await expect(
        service.sendPasswordResetEmail('user@test.com', 'Juan', 'reset_token'),
      ).rejects.toThrow('Resend error');
    });
  });
});
