import { IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class CreatePaymentDto {

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  orderId: number;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.MERCADOPAGO })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}
