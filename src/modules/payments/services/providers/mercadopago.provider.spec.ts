import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Preference } from 'mercadopago';

import { MercadoPagoProvider } from './mercadopago.provider';
import { OrderEntity } from '../../../orders/entities/order.entity';

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn(),
}));

describe('MercadoPagoProvider', () => {
  let provider: MercadoPagoProvider;
  let mockCreate: jest.Mock;

  const mockConfig: Record<string, string> = {
    MP_ACCESS_TOKEN: 'test-token',
    FRONTEND_URL: 'https://front.test',
    MP_NOTIFICATION_URL: 'https://api.test/webhook',
  };

  const mockOrder = (overrides: any = {}): OrderEntity =>
    ({
      id: 42,
      total: 1500.75,
      ...overrides,
    }) as OrderEntity;

  beforeEach(async () => {
    mockCreate = jest.fn();
    (Preference as jest.Mock).mockImplementation(() => ({
      create: mockCreate,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadoPagoProvider,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => mockConfig[key] },
        },
      ],
    }).compile();

    provider = module.get<MercadoPagoProvider>(MercadoPagoProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send the exact order total to MercadoPago, without rounding', async () => {
    mockCreate.mockResolvedValue({
      id: 'pref_1',
      init_point: 'https://mp.com/checkout',
    });

    await provider.createPreference(mockOrder({ total: 1500.75 }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          items: [expect.objectContaining({ unit_price: 1500.75 })],
        }),
      }),
    );
  });

  it('should return the preference id and checkout url', async () => {
    mockCreate.mockResolvedValue({
      id: 'pref_2',
      init_point: 'https://mp.com/checkout/2',
    });

    const result = await provider.createPreference(mockOrder());

    expect(result).toEqual({
      id: 'pref_2',
      checkoutUrl: 'https://mp.com/checkout/2',
    });
  });

  it('should set external_reference and item id to the order id', async () => {
    mockCreate.mockResolvedValue({ id: 'pref_3', init_point: 'url' });

    await provider.createPreference(mockOrder({ id: 7 }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          external_reference: '7',
          items: [expect.objectContaining({ id: '7' })],
        }),
      }),
    );
  });
});
