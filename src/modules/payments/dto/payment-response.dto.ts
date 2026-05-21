import { ApiProperty } from '@nestjs/swagger';
import { PaymentEntity } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class PaymentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 42 })
  orderId: number;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.MERCADOPAGO })
  provider: PaymentProvider;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  status: PaymentStatus;

  @ApiProperty({ example: 'pref_abc123', nullable: true })
  externalId?: string | null;

  @ApiProperty({
    example:
      'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_abc123',
    nullable: true,
  })
  checkoutUrl?: string | null;

  @ApiProperty({ example: 4950 })
  amount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: PaymentEntity) {
    this.id = entity.id;
    this.orderId = entity.orderId;
    this.provider = entity.provider;
    this.status = entity.status;
    this.externalId = entity.externalId;
    this.checkoutUrl = entity.checkoutUrl;
    this.amount = entity.amount;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
