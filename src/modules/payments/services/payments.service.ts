import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
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

// Únicos providers con integración real hoy. El enum PaymentProvider puede
// declarar otros a futuro sin que eso los habilite acá.
const IMPLEMENTED_PROVIDERS: PaymentProvider[] = [PaymentProvider.MERCADOPAGO];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,

    private readonly mercadoPagoProvider: MercadoPagoProvider,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
  ) {}

  // ==========================
  // CREATE PAYMENT
  // ==========================

  async create(
    userId: number,
    role: RoleType,
    dto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    if (!IMPLEMENTED_PROVIDERS.includes(dto.provider)) {
      throw new BadRequestException(
        `El proveedor de pago "${dto.provider}" todavía no está soportado`,
      );
    }

    // Fase 1 (con lock, rápida): validar la orden y reservar el intento de
    // pago en la DB. Nunca hacemos la llamada externa a MercadoPago acá —
    // si tardara o se colgara, dejaría la orden bloqueada para cancelar,
    // aplicar cupón, etc. mientras dure el request.
    const { payment, order } = await this.dataSource.transaction(
      async (manager) => {
        const order = await manager.findOne(OrderEntity, {
          where: { id: dto.orderId },
          lock: { mode: 'pessimistic_write' },
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

        const payment = manager.create(PaymentEntity, {
          orderId: dto.orderId,
          provider: dto.provider,
          status: PaymentStatus.PENDING,
          externalId: null,
          checkoutUrl: null,
          amount: order.total,
        });

        const saved = await manager.save(PaymentEntity, payment);
        return { payment: saved, order };
      },
    );

    // Fase 2 (sin lock): llamar a MercadoPago. Si falla, el intento
    // reservado se marca REJECTED en vez de quedar como un PENDING
    // fantasma que bloquee futuros intentos de pago sobre la orden.
    try {
      const preference = await this.mercadoPagoProvider.createPreference(order);
      payment.externalId = preference.id;
      payment.checkoutUrl = preference.checkoutUrl;
      const saved = await this.paymentRepo.save(payment);
      return new PaymentResponseDto(saved);
    } catch (err) {
      await this.paymentRepo.update(payment.id, {
        status: PaymentStatus.REJECTED,
      });
      throw err;
    }
  }

  // ==========================
  // WEBHOOK MERCADOPAGO
  // ==========================

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
      // id de la preference (payment.externalId) — nos permite identificar a
      // qué intento de pago puntual corresponde esta notificación, en vez de
      // asumir que es sobre el más reciente de la orden (ver más abajo).
      let preferenceId: string | null | undefined;

      if (topic === 'payment') {
        // topic=payment → usar Payment API para obtener la info del pago
        const mpPayment = new Payment(this.mercadoPagoProvider.getClient());
        const paymentData = await mpPayment.get({ id: String(id) });
        externalReference = paymentData.external_reference;
        // mapear status de Payment al mismo vocabulario que MerchantOrder
        const s = paymentData.status;
        if (s === 'approved') mpStatus = 'paid';
        else if (s === 'refunded' || s === 'charged_back')
          mpStatus = 'reverted';
        else if (s === 'in_process' || s === 'pending')
          mpStatus = 'payment_in_process';
        else mpStatus = 'expired';

        // El recurso Payment no trae preference_id directo — lo resolvemos
        // vía la merchant_order asociada. Si falla, seguimos sin
        // preferenceId (ver fallback más abajo) en vez de perder la notificación.
        if (paymentData.order?.id) {
          try {
            const merchantOrder = new MerchantOrder(
              this.mercadoPagoProvider.getClient(),
            );
            const mpOrder = await merchantOrder.get({
              merchantOrderId: Number(paymentData.order.id),
            });
            preferenceId = mpOrder.preference_id;
          } catch {
            this.logger.warn(
              `No se pudo resolver preference_id para el pago MP ${id} (merchant_order ${paymentData.order.id})`,
            );
          }
        }
      } else {
        // topic=merchant_order → usar MerchantOrder API
        const merchantOrder = new MerchantOrder(
          this.mercadoPagoProvider.getClient(),
        );
        const mpOrder = await merchantOrder.get({
          merchantOrderId: Number(id),
        });
        externalReference = mpOrder.external_reference;
        mpStatus = mpOrder.order_status;
        preferenceId = mpOrder.preference_id;
      }

      if (!externalReference) return;

      // 🔥 toda la lógica de DB dentro de la transacción con locks de fila —
      // evita race condition entre dos notificaciones simultáneas del mismo pago
      await this.dataSource.transaction(async (manager) => {
        // No filtramos por status: PENDING acá — necesitamos poder ver un
        // pago ya CANCELLED (por ejemplo, porque un admin canceló la orden
        // mientras el link de checkout seguía abierto) para detectar el
        // conflicto de abajo en vez de perderlo silenciosamente.
        //
        // Si tenemos preferenceId, filtramos también por externalId: una
        // orden puede tener varios intentos de pago (uno REJECTED y otro
        // PENDING más nuevo) y una notificación tardía sobre un intento
        // viejo no debe terminar actualizando el intento más reciente solo
        // por ser "el último de la orden". Sin preferenceId (no se pudo
        // resolver) caemos al comportamiento anterior como fallback.
        const payment = await manager.findOne(PaymentEntity, {
          where: preferenceId
            ? { orderId: Number(externalReference), externalId: preferenceId }
            : { orderId: Number(externalReference) },
          order: { createdAt: 'DESC' },
          lock: { mode: 'pessimistic_write' },
        });

        if (!payment) return;

        if (payment.status !== PaymentStatus.PENDING) {
          // Notificación repetida/tardía — el pago ya quedó resuelto.
          // Caso especial: la orden se canceló (admin) mientras el link de
          // pago seguía abierto y el cliente terminó pagando igual. No lo
          // aprobamos en silencio — se cobró plata por una orden cancelada
          // y necesita revisión manual (reembolso).
          if (
            payment.status === PaymentStatus.CANCELLED &&
            mpStatus === 'paid'
          ) {
            this.logger.error(
              `MercadoPago reportó como pagado el pago ${payment.id} (orden ${payment.orderId}) pero ya estaba CANCELLED — requiere revisión manual`,
            );
            payment.metadata = {
              requiresManualReview: true,
              mpStatus,
              body,
              query,
            };
            await manager.save(payment);
          }
          return;
        }

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
        } else if (
          mpStatus === 'reverted' ||
          mpStatus === 'refunded' // merchant_order devuelve 'refunded', payment normaliza a 'reverted'
        ) {
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
          await this.ordersService.releaseStockForOrder(
            payment.orderId,
            manager,
          );
          await manager.save(order);
        }
        await manager.save(payment);
      });
    } catch {
      // swallow — MP requiere siempre 200
    }
  }

  // ==========================
  // FIND BY ORDER
  // ==========================

  async findByOrder(
    orderId: number,
    userId: number,
    role: RoleType,
  ): Promise<PaymentResponseDto[]> {
    if (role === RoleType.CLIENT) {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Orden no encontrada');
      if (order.userId !== userId)
        throw new ForbiddenException('Acceso denegado');
    }

    const payments = await this.paymentRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    return payments.map((p) => new PaymentResponseDto(p));
  }

  // ==========================
  // FIND ONE
  // ==========================

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
