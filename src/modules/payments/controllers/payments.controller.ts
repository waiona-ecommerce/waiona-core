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
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Env } from 'src/env.model';

import { PaymentsService } from '../services/payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { RoleType } from 'src/common/enums/role-type.enum';

@Controller('payments')
export class PaymentsController {

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService<Env>,
  ) {}

  // ==========================
  // CREATE (cliente autenticado)
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Req() req: Request, @Body() dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    const payload = req.user as { sub: number; role: RoleType };
    return this.paymentsService.create(payload.sub, payload.role, dto);
  }

  // ==========================
  // WEBHOOK MERCADOPAGO
  // Público — MP no manda token JWT
  // Siempre devuelve 200 — MP reintenta si no recibe 200
  // ==========================

  @SkipThrottle()
  @Post('webhook/mercadopago')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoWebhook(
    @Body() body: any,
    @Query() query: any,
    @Headers() headers: Record<string, string>,
  ) {
    // 🔥 verificar firma de MercadoPago
    this.verifyMercadoPagoSignature(headers, query);

    // siempre retornar 200 — el error se swallow en el service
    await this.paymentsService.handleMercadoPagoWebhook(body, query);
    return { received: true };
  }

  // ==========================
  // GET BY ORDER
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Get('order/:orderId')
  findByOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Req() req: Request,
  ): Promise<PaymentResponseDto[]> {
    const payload = req.user as { sub: number; role: RoleType };
    return this.paymentsService.findByOrder(orderId, payload.sub, payload.role);
  }

  // ==========================
  // GET ONE
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<PaymentResponseDto> {
    const payload = req.user as { sub: number; role: RoleType };
    return this.paymentsService.findOne(id, payload.sub, payload.role);
  }

  // ==========================
  // PRIVATE — verificar firma MP
  // Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
  // ==========================

  private verifyMercadoPagoSignature(
    headers: Record<string, string>,
    query: Record<string, string>,
  ): void {
    const secret = this.configService.get('MP_WEBHOOK_SECRET', { infer: true });
    if (!secret) throw new UnauthorizedException('Webhook secret not configured');

    const xSignature  = headers['x-signature'];
    const xRequestId  = headers['x-request-id'];

    if (!xSignature || !xRequestId) {
      throw new UnauthorizedException('Missing MercadoPago signature headers');
    }

    // x-signature tiene formato: ts=<timestamp>,v1=<hash>
    const parts     = xSignature.split(',');
    const tsPart    = parts.find(p => p.startsWith('ts='));
    const v1Part    = parts.find(p => p.startsWith('v1='));

    if (!tsPart || !v1Part) {
      throw new UnauthorizedException('Invalid MercadoPago signature format');
    }

    const ts   = tsPart.split('=')[1];
    const v1   = v1Part.split('=')[1];
    const dataId = query['data.id'] ?? query['id'] ?? '';

    // manifest a firmar: id:<dataId>;request-id:<xRequestId>;ts:<ts>;
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    if (expected !== v1) {
      throw new UnauthorizedException('Invalid MercadoPago signature');
    }
  }
}