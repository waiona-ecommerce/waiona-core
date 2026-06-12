# Payments — Código fuente completo

## `payments.module.ts`

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { PaymentEntity } from './entities/payment.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';

import { PaymentsService } from './services/payments.service';
import { MercadoPagoProvider } from './services/providers/mercadopago.provider';
import { PaymentsController } from './controllers/payments.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PaymentEntity, OrderEntity]),
    OrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

---

## `enums/payment-status.enum.ts`

```ts
export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
```

---

## `enums/payment-provider.enum.ts`

```ts
export enum PaymentProvider {
  MERCADOPAGO = 'mercadopago',
  STRIPE = 'stripe',
}
```

---

## `entities/payment.entity.ts`

```ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OrderEntity } from '../../orders/entities/order.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

@Entity('payments')
@Index(['orderId'])
@Index(['externalId'])
export class PaymentEntity extends BaseEntity {
  @Column({ name: 'order_id', type: 'int', nullable: false })
  orderId: number;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    nullable: false,
  })
  provider: PaymentProvider;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    nullable: false,
  })
  status: PaymentStatus;

  @Column({
    name: 'external_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  externalId?: string | null;

  @Column({
    name: 'checkout_url',
    type: 'varchar',
    length: 500,
    nullable: true,
    default: null,
  })
  checkoutUrl?: string | null;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    nullable: false,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  amount: number;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: null,
  })
  metadata?: Record<string, any> | null;
}
```

---

## `dto/create-payment.dto.ts`

```ts
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
```

---

## `dto/payment-response.dto.ts`

```ts
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
    example: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_abc123',
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
```

---

## `dto/mercadopago-webhook.dto.ts`

```ts
export interface MercadoPagoWebhookBody {
  type?: string;
  data?: { id?: string | number };
}
```

---

## `services/providers/mercadopago.provider.ts`

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Env } from '../../../../env.model';
import { OrderEntity } from '../../../orders/entities/order.entity';

@Injectable()
export class MercadoPagoProvider {
  private readonly client: MercadoPagoConfig;
  private readonly preference: Preference;

  constructor(private readonly configService: ConfigService<Env>) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get('MP_ACCESS_TOKEN', { infer: true })!,
    });

    this.preference = new Preference(this.client);
  }

  getClient(): MercadoPagoConfig {
    return this.client;
  }

  async createPreference(
    order: OrderEntity,
  ): Promise<{ id: string; checkoutUrl: string }> {
    const frontendUrl = this.configService.get('FRONTEND_URL', { infer: true })!;
    const notificationUrl = this.configService.get('MP_NOTIFICATION_URL', { infer: true })!;

    const response = await this.preference.create({
      body: {
        items: [
          {
            id: String(order.id),
            title: `Orden #${order.id}`,
            quantity: 1,
            unit_price: Math.round(Number(order.total)),
            currency_id: 'ARS',
          },
        ],
        external_reference: String(order.id),
        back_urls: {
          success: `${frontendUrl}/payment/success`,
          failure: `${frontendUrl}/payment/failure`,
          pending: `${frontendUrl}/payment/pending`,
        },
        auto_return: 'approved',
        notification_url: notificationUrl,
      },
    });

    return {
      id: response.id!,
      checkoutUrl: response.init_point!,
    };
  }
}
```

---

## `services/payments.service.ts`

```ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { PaymentEntity } from '../entities/payment.entity';
import { OrderEntity } from '../../orders/entities/order.entity';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { MerchantOrder, Payment } from 'mercadopago';

import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { MercadoPagoWebhookBody } from '../dto/mercadopago-webhook.dto';

import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { RoleType } from '../../../common/enums/role-type.enum';
import { OrdersService } from '../../orders/services/orders.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,

    private readonly mercadoPagoProvider: MercadoPagoProvider,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
  ) {}

  async create(
    userId: number,
    role: RoleType,
    dto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(OrderEntity, {
        where: { id: dto.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked) throw new NotFoundException('Orden no encontrada');

      const order = await manager.findOne(OrderEntity, {
        where: { id: dto.orderId },
      });

      if (!order) throw new NotFoundException('Orden no encontrada');

      if (role === RoleType.CLIENT && order.userId !== userId) {
        throw new ForbiddenException('Acceso denegado');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException('La orden no está en estado pagable');
      }

      const existingPayment = await manager.findOne(PaymentEntity, {
        where: { orderId: dto.orderId, status: PaymentStatus.PENDING },
      });

      if (existingPayment) {
        throw new BadRequestException('La orden ya tiene un pago pendiente');
      }

      let externalId: string | null = null;
      let checkoutUrl: string | null = null;

      if (dto.provider === PaymentProvider.MERCADOPAGO) {
        const preference = await this.mercadoPagoProvider.createPreference(order);
        externalId = preference.id;
        checkoutUrl = preference.checkoutUrl;
      }

      const payment = manager.create(PaymentEntity, {
        orderId: dto.orderId,
        provider: dto.provider,
        status: PaymentStatus.PENDING,
        externalId,
        checkoutUrl,
        amount: order.total,
      });

      const saved = await manager.save(PaymentEntity, payment);
      return new PaymentResponseDto(saved);
    });
  }

  async handleMercadoPagoWebhook(
    body: MercadoPagoWebhookBody,
    query: Record<string, string>,
  ): Promise<void> {
    const topic = query['topic'] ?? body.type;
    const id = query['id'] ?? body.data?.id;

    if (!id) return;
    if (topic !== 'payment' && topic !== 'merchant_order') return;

    try {
      let externalReference: string | null | undefined;
      let mpStatus: string | null | undefined;

      if (topic === 'payment') {
        const mpPayment = new Payment(this.mercadoPagoProvider.getClient());
        const paymentData = await mpPayment.get({ id: String(id) });
        externalReference = paymentData.external_reference;
        const s = paymentData.status;
        if (s === 'approved') mpStatus = 'paid';
        else if (s === 'refunded' || s === 'charged_back') mpStatus = 'reverted';
        else if (s === 'in_process' || s === 'pending') mpStatus = 'payment_in_process';
        else mpStatus = 'expired';
      } else {
        const merchantOrder = new MerchantOrder(this.mercadoPagoProvider.getClient());
        const mpOrder = await merchantOrder.get({ merchantOrderId: Number(id) });
        externalReference = mpOrder.external_reference;
        mpStatus = mpOrder.order_status;
      }

      if (!externalReference) return;

      await this.dataSource.transaction(async (manager) => {
        const payment = await manager.findOne(PaymentEntity, {
          where: { orderId: Number(externalReference) },
          lock: { mode: 'pessimistic_write' },
        });

        if (!payment) return;

        const order = await manager.findOne(OrderEntity, {
          where: { id: payment.orderId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!order) return;

        const orderStatus = order.status;
        const cancellable =
          orderStatus === OrderStatus.PENDING ||
          orderStatus === OrderStatus.CONFIRMED;
        let orderChanged = false;

        if (mpStatus === 'paid') {
          payment.status = PaymentStatus.APPROVED;
          if (orderStatus === OrderStatus.PENDING) {
            order.status = OrderStatus.CONFIRMED;
            orderChanged = true;
          }
        } else if (mpStatus === 'reverted' || mpStatus === 'refunded') {
          payment.status = PaymentStatus.CANCELLED;
          if (cancellable) {
            order.status = OrderStatus.CANCELLED;
            orderChanged = true;
          }
        } else if (
          mpStatus === 'payment_required' ||
          mpStatus === 'payment_in_process'
        ) {
          payment.status = PaymentStatus.PENDING;
        } else {
          payment.status = PaymentStatus.REJECTED;
          if (cancellable) {
            order.status = OrderStatus.CANCELLED;
            orderChanged = true;
          }
        }

        payment.metadata = { body, query };

        if (orderChanged) {
          await this.ordersService.releaseStockForOrder(payment.orderId, manager);
          await manager.save(order);
        }
        await manager.save(payment);
      });
    } catch {
      // swallow — MP requiere siempre 200
    }
  }

  async findByOrder(
    orderId: number,
    userId: number,
    role: RoleType,
  ): Promise<PaymentResponseDto[]> {
    if (role === RoleType.CLIENT) {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Orden no encontrada');
      if (order.userId !== userId) throw new ForbiddenException('Acceso denegado');
    }

    const payments = await this.paymentRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    return payments.map((p) => new PaymentResponseDto(p));
  }

  async findOne(
    id: number,
    userId: number,
    role: RoleType,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: role === RoleType.CLIENT ? ['order'] : [],
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (role === RoleType.CLIENT && payment.order?.userId !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }
    return new PaymentResponseDto(payment);
  }
}
```

---

## `controllers/payments.controller.ts`

```ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { createHmac } from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { Env } from '../../../env.model';

import { PaymentsService } from '../services/payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';
import type { MercadoPagoWebhookBody } from '../dto/mercadopago-webhook.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller({ version: '1', path: 'payments' })
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService<Env>,
  ) {}

  @ApiOperation({ summary: 'Create a payment for an order' })
  @ApiResponse({ status: 201, type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Order not payable or already has a pending payment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.create(user.sub, user.role, dto);
  }

  @ApiOperation({ summary: 'MercadoPago webhook — always returns 200' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  @SkipThrottle()
  @Post('webhook/mercadopago')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoWebhook(
    @Body() body: MercadoPagoWebhookBody,
    @Query() query: Record<string, string>,
    @Headers() headers: Record<string, string>,
  ) {
    try {
      this.verifyMercadoPagoSignature(headers, query);
    } catch {
      return { received: true };
    }

    await this.paymentsService.handleMercadoPagoWebhook(body, query);
    return { received: true };
  }

  @ApiOperation({ summary: 'Get payments by order ID' })
  @ApiParam({ name: 'orderId', type: Number })
  @ApiResponse({ status: 200, type: PaymentResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @UseGuards(AuthGuard('jwt'))
  @Get('order/:orderId')
  findByOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaymentResponseDto[]> {
    return this.paymentsService.findByOrder(orderId, user.sub, user.role);
  }

  @ApiOperation({ summary: 'Get a payment by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.findOne(id, user.sub, user.role);
  }

  private verifyMercadoPagoSignature(
    headers: Record<string, string>,
    query: Record<string, string>,
  ): void {
    const secret = this.configService.get('MP_WEBHOOK_SECRET', { infer: true });
    if (!secret) return;

    const xSignature = headers['x-signature'];
    const xRequestId = headers['x-request-id'];

    if (!xSignature || !xRequestId) {
      throw new UnauthorizedException('Faltan los headers de firma de MercadoPago');
    }

    const parts = xSignature.split(',');
    const tsPart = parts.find((p) => p.startsWith('ts='));
    const v1Part = parts.find((p) => p.startsWith('v1='));

    if (!tsPart || !v1Part) {
      throw new UnauthorizedException('Formato de firma de MercadoPago inválido');
    }

    const ts = tsPart.split('=')[1];
    const v1 = v1Part.split('=')[1];
    const dataId = query['data.id'] ?? query['id'] ?? '';

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    if (expected !== v1) {
      throw new UnauthorizedException('Firma de MercadoPago inválida');
    }
  }
}
```
