import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { OrderEntity } from '../entities/order.entity';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { OrderItemEntity } from '../entities/order-item.entity';
import { ProductEntity } from '../../products/product/entities/product.entity';
import { ComboEntity } from '../../products/combos/entities/combo.entity';
import { CouponEntity } from '../../coupons/coupon/entities/coupon.entity';
import { StockItemEntity } from '../../stocks/stock-item/entities/stock-item.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { PaymentEntity } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';

import { StockItemsService } from '../../stocks/stock-item/services/stock-item.service';
import { CalculationService } from '../../pricing/calculation/services/calculation.service';
import { MailService } from '../../mail/services/mail.service';
import {
  CouponUsageService,
  CouponUsageItem,
} from '../../coupons/usage/services/coupon-usage.service';

import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { OrderStatus } from '../enums/order-status.enum';
import { DeliveryType } from '../enums/delivery-type.enum';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,

    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,

    @InjectRepository(ComboEntity)
    private readonly comboRepo: Repository<ComboEntity>,

    @InjectRepository(StockItemEntity)
    private readonly stockItemRepo: Repository<StockItemEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    private readonly stockItemsService: StockItemsService,
    private readonly calculationService: CalculationService,
    private readonly mailService: MailService,
    private readonly couponUsageService: CouponUsageService,
    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(userId: number, dto: CreateOrderDto): Promise<OrderResponseDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // 1. Validar items
    for (const item of dto.items) {
      if (!item.productId && !item.comboId) {
        throw new BadRequestException(
          'Cada ítem debe tener un productId o comboId',
        );
      }
      if (item.productId && item.comboId) {
        throw new BadRequestException(
          'Cada ítem debe tener productId o comboId, no ambos',
        );
      }
    }

    // 2. Validar dirección si es delivery
    if (dto.deliveryType === DeliveryType.DELIVERY && !dto.address) {
      throw new BadRequestException(
        'La dirección es requerida para órdenes con delivery',
      );
    }

    // 3. Calcular precios y validar productos/combos ANTES de la transacción.
    //    La selección de ubicación de stock se hace DENTRO de la transacción
    //    para leer datos frescos y reducir la ventana de race condition.
    //    reserveStock (pessimistic_write) serializa el acceso al stock final.
    const orderItems: OrderItemEntity[] = [];
    const productStockNeeds: {
      orderItem: OrderItemEntity;
      productId: number;
      quantity: number;
    }[] = [];
    const comboStockNeeds: {
      orderItem: OrderItemEntity;
      needs: { productId: number; quantity: number }[];
    }[] = [];
    let subtotal = 0;
    const couponItems: CouponUsageItem[] = [];

    for (const item of dto.items) {
      if (item.productId) {
        const product = await this.productRepo.findOne({
          where: { id: item.productId },
        });
        if (!product)
          throw new NotFoundException(
            `Producto con id ${item.productId} no encontrado`,
          );

        const breakdown = await this.calculationService.calculateProduct({
          productId: item.productId,
        });

        const itemSubtotal = breakdown.finalPrice * item.quantity;

        const orderItem = this.orderItemRepo.create({
          product,
          quantity: item.quantity,
          unitPrice: breakdown.unitPrice,
          salePrice: breakdown.salePrice,
          finalPrice: itemSubtotal,
          // locationId se asigna dentro de la transacción
        });

        orderItems.push(orderItem);
        productStockNeeds.push({
          orderItem,
          productId: item.productId,
          quantity: item.quantity,
        });
        subtotal += itemSubtotal;
        couponItems.push({ productId: item.productId, subtotal: itemSubtotal });
      } else if (item.comboId) {
        const combo = await this.comboRepo.findOne({
          where: { id: item.comboId },
          relations: ['items'],
        });
        if (!combo)
          throw new NotFoundException(
            `Combo con id ${item.comboId} no encontrado`,
          );

        const breakdown = await this.calculationService.calculateCombo({
          comboId: item.comboId,
        });

        const itemSubtotal = breakdown.finalPrice * item.quantity;

        const orderItem = this.orderItemRepo.create({
          combo,
          quantity: item.quantity,
          unitPrice: breakdown.unitPrice,
          salePrice: breakdown.salePrice,
          finalPrice: itemSubtotal,
          // comboReservations se asigna dentro de la transacción
        });

        orderItems.push(orderItem);
        comboStockNeeds.push({
          orderItem,
          needs: combo.items.map((ci) => ({
            productId: ci.productId,
            quantity: item.quantity * ci.quantity,
          })),
        });
        subtotal += itemSubtotal;
        couponItems.push({ comboId: item.comboId, subtotal: itemSubtotal });
      }
    }

    // 4. 🔥 Transacción — seleccionar stock con datos frescos, reservar, guardar orden y cupón
    const saved = await this.dataSource.transaction(async (manager) => {
      // 4a. Seleccionar ubicaciones de stock dentro de la transacción
      const stockReservations: {
        productId: number;
        locationId: number;
        quantity: number;
      }[] = [];

      for (const { orderItem, productId, quantity } of productStockNeeds) {
        const stockItem = await this.findAvailableStockItem(
          productId,
          quantity,
          manager,
        );
        orderItem.locationId = stockItem.locationId;
        stockReservations.push({
          productId,
          locationId: stockItem.locationId,
          quantity,
        });
      }

      for (const { orderItem, needs } of comboStockNeeds) {
        const comboReservations: {
          productId: number;
          locationId: number;
          quantity: number;
        }[] = [];
        for (const { productId, quantity } of needs) {
          const stockItem = await this.findAvailableStockItem(
            productId,
            quantity,
            manager,
          );
          comboReservations.push({
            productId,
            locationId: stockItem.locationId,
            quantity,
          });
          stockReservations.push({
            productId,
            locationId: stockItem.locationId,
            quantity,
          });
        }
        orderItem.comboReservations = comboReservations;
      }

      // 4b. Validar y calcular descuento de cupón — lógica de coupons,
      // orders solo le pasa su transacción y aplica el resultado.
      let lockedCoupon: CouponEntity | null = null;
      let couponDiscount = 0;

      if (dto.couponCode) {
        const result = await this.couponUsageService.validateAndComputeDiscount(
          dto.couponCode,
          user.id,
          couponItems,
          manager,
        );
        lockedCoupon = result.coupon;
        couponDiscount = result.discount;
      }

      const total = Math.max(0, subtotal - couponDiscount);

      // 4c. Guardar orden
      const order = manager.create(OrderEntity, {
        user,
        items: orderItems,
        status: OrderStatus.PENDING,
        deliveryType: dto.deliveryType,
        address: dto.address ?? null,
        notes: dto.notes ?? null,
        subtotal,
        couponDiscount: couponDiscount > 0 ? couponDiscount : null,
        coupon: lockedCoupon ?? null,
        total,
      });

      const savedOrder = await manager.save(OrderEntity, order);

      // 4d. Reservar stock — atómico con el save de la orden
      for (const reservation of stockReservations) {
        await this.stockItemsService.reserveStock(
          reservation.productId,
          reservation.locationId,
          reservation.quantity,
          manager,
        );
      }

      // 4e. Registrar uso del cupón — solo si efectivamente generó descuento
      if (lockedCoupon && couponDiscount > 0) {
        await this.couponUsageService.recordUsage(
          lockedCoupon,
          user.id,
          savedOrder.id,
          manager,
        );
      }

      return savedOrder;
    });

    return new OrderResponseDto(saved);
  }

  // ==========================
  // APPLY COUPON (a una orden pendiente ya creada)
  // ==========================

  async applyCoupon(
    orderId: number,
    code: string,
    userId: number,
  ): Promise<OrderResponseDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      // lock only — no relations, evita el error de Postgres "FOR UPDATE
      // on nullable outer join" (items.product/items.combo son LEFT JOIN)
      const locked = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.userId !== userId) {
        throw new NotFoundException('Orden no encontrada');
      }
      if (locked.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          'Solo se puede aplicar un cupón a una orden pendiente',
        );
      }
      if (locked.couponId) {
        throw new ConflictException('La orden ya tiene un cupón aplicado');
      }

      // Si ya existe una preferencia de pago pendiente, su monto quedó
      // fijado (MercadoPago, etc.) con el total viejo — cambiar el total acá
      // desincronizaría lo que el cliente paga de lo que la orden dice que
      // cuesta. Se bloquea hasta que ese pago se resuelva o cancele.
      const pendingPayment = await manager.findOne(PaymentEntity, {
        where: { orderId, status: PaymentStatus.PENDING },
      });
      if (pendingPayment) {
        throw new ConflictException(
          'La orden tiene un pago en curso; no se puede modificar el cupón',
        );
      }

      const order = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['items', 'items.product', 'items.combo'],
      });
      if (!order) throw new NotFoundException('Orden no encontrada');

      const couponItems: CouponUsageItem[] = order.items.map((item) => ({
        productId: item.product?.id,
        comboId: item.combo?.id,
        subtotal: Number(item.finalPrice),
      }));

      const { coupon, discount } =
        await this.couponUsageService.validateAndComputeDiscount(
          code,
          userId,
          couponItems,
          manager,
        );

      order.couponDiscount = discount;
      order.coupon = coupon;
      order.total = Math.max(0, Number(order.subtotal) - discount);
      const savedOrder = await manager.save(OrderEntity, order);

      await this.couponUsageService.recordUsage(
        coupon,
        userId,
        savedOrder.id,
        manager,
      );

      return savedOrder;
    });

    return new OrderResponseDto(saved);
  }

  // ==========================
  // FIND ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const [orders, total] = await this.orderRepo.findAndCount({
      relations: ['user', 'items', 'items.product', 'items.combo', 'coupon'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      orders.map((o) => new OrderResponseDto(o)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // FIND ONE
  // ==========================

  async findOne(id: number): Promise<OrderResponseDto> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product', 'items.combo', 'coupon'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return new OrderResponseDto(order);
  }

  // ==========================
  // FIND BY USER
  // ==========================

  async findByUser(userId: number): Promise<OrderResponseDto[]> {
    const orders = await this.orderRepo.find({
      where: { userId },
      relations: ['user', 'items', 'items.product', 'items.combo', 'coupon'],
      order: { createdAt: 'DESC' },
    });
    return orders.map((o) => new OrderResponseDto(o));
  }

  // ==========================
  // UPDATE STATUS
  // ==========================

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      // lock only — no relations to avoid "FOR UPDATE on nullable outer join" PostgreSQL error
      const locked = await manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Orden no encontrada');

      const order = await manager.findOne(OrderEntity, {
        where: { id },
        relations: ['user', 'items', 'items.product', 'items.combo', 'coupon'],
      });
      if (!order) throw new NotFoundException('Orden no encontrada');

      this.validateStatusTransition(order.status, dto.status);

      if (dto.status === OrderStatus.DISPATCHED) {
        await this.handleDispatch(order, manager);
      }

      if (dto.status === OrderStatus.CANCELLED) {
        await this.handleCancellation(order, manager);
      }

      order.status = dto.status;
      return manager.save(OrderEntity, order);
    });

    this.sendStatusEmail(saved, dto.status).catch((err) =>
      this.logger.error('Failed to send order status email', err),
    );

    return new OrderResponseDto(saved);
  }

  // ==========================
  // PRIVATE — validar transición
  // ==========================

  private validateStatusTransition(
    current: OrderStatus,
    next: OrderStatus,
  ): void {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
      [OrderStatus.DISPATCHED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(
        `No se puede cambiar la orden de "${current}" a "${next}"`,
      );
    }
  }

  // ==========================
  // RELEASE STOCK (llamado desde pagos al cancelar por webhook)
  // ==========================

  async releaseStockForOrder(
    orderId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const execute = async (txManager: EntityManager) => {
      // lock only — no relations to avoid "FOR UPDATE on nullable outer join" PostgreSQL error
      const locked = await txManager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) return;
      if (
        locked.status !== OrderStatus.PENDING &&
        locked.status !== OrderStatus.CONFIRMED
      )
        return;

      const order = await txManager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['items', 'items.product', 'items.combo', 'coupon'],
      });
      if (!order) return;
      order.status = OrderStatus.CANCELLED;
      await txManager.save(OrderEntity, order);
      // invalidatePendingPayments: false — quien nos llama (el webhook de
      // MercadoPago) ya está resolviendo el estado del pago que disparó
      // esta cancelación; no hace falta que lo pisemos acá también.
      await this.handleCancellation(order, txManager, {
        invalidatePendingPayments: false,
      });
    };

    if (manager) return execute(manager);
    return this.dataSource.transaction(execute);
  }

  // ==========================
  // PRIVATE — stock disponible
  // ==========================

  private async findAvailableStockItem(
    productId: number,
    quantity: number,
    manager?: EntityManager,
  ): Promise<StockItemEntity> {
    const items = manager
      ? await manager.find(StockItemEntity, { where: { productId } })
      : await this.stockItemRepo.find({ where: { productId } });

    if (!items.length) {
      throw new NotFoundException(
        `No se encontró stock para el producto ${productId}`,
      );
    }

    // misma lógica que ShopService: la ubicación con más stock disponible
    const best = items.reduce((prev, curr) =>
      curr.quantityAvailable > prev.quantityAvailable ? curr : prev,
    );

    if (best.quantityAvailable < quantity) {
      throw new BadRequestException(
        `Stock disponible insuficiente para el producto ${productId}`,
      );
    }

    return best;
  }

  // ==========================
  // PRIVATE — despachar
  // ==========================

  private async handleDispatch(
    order: OrderEntity,
    manager: EntityManager,
  ): Promise<void> {
    for (const item of order.items) {
      if (item.product) {
        if (!item.locationId) continue;
        await this.stockItemsService.dispatchStock(
          item.product.id,
          item.locationId,
          item.quantity,
          order.id,
          manager,
        );
      } else if (item.combo) {
        if (!item.comboReservations?.length) continue;
        for (const res of item.comboReservations) {
          await this.stockItemsService.dispatchStock(
            res.productId,
            res.locationId,
            res.quantity,
            order.id,
            manager,
          );
        }
      }
    }
  }

  // ==========================
  // PRIVATE — cancelar
  // ==========================

  private async handleCancellation(
    order: OrderEntity,
    manager: EntityManager,
    options: { invalidatePendingPayments?: boolean } = {},
  ): Promise<void> {
    const { invalidatePendingPayments = true } = options;

    for (const item of order.items) {
      if (item.product) {
        if (!item.locationId) continue;
        await this.stockItemsService.releaseReservation(
          item.product.id,
          item.locationId,
          item.quantity,
          order.id,
          manager,
        );
      } else if (item.combo) {
        if (!item.comboReservations?.length) continue;
        for (const res of item.comboReservations) {
          await this.stockItemsService.releaseReservation(
            res.productId,
            res.locationId,
            res.quantity,
            order.id,
            manager,
          );
        }
      }
    }

    if (order.couponId) {
      await this.couponUsageService.releaseUsage(
        order.couponId,
        order.id,
        manager,
      );
    }

    if (invalidatePendingPayments) {
      // Un checkout que quedó abierto (link de MercadoPago) no debe poder
      // seguir pagando una orden ya cancelada — si no lo invalidamos acá,
      // un webhook tardío podría aprobarlo igual (ver handleMercadoPagoWebhook).
      await manager.update(
        PaymentEntity,
        { orderId: order.id, status: PaymentStatus.PENDING },
        { status: PaymentStatus.CANCELLED },
      );
    }
  }

  // ==========================
  // PRIVATE — notificación por email
  // ==========================

  private async sendStatusEmail(
    order: OrderEntity,
    status: OrderStatus,
  ): Promise<void> {
    const user = order.user;
    if (!user?.email || !user?.profile) return;

    const {
      email,
      profile: { name },
    } = user;

    switch (status) {
      case OrderStatus.CONFIRMED:
        return this.mailService.sendOrderConfirmedEmail(email, name, order.id);
      case OrderStatus.DISPATCHED:
        return this.mailService.sendOrderDispatchedEmail(email, name, order.id);
      case OrderStatus.CANCELLED:
        return this.mailService.sendOrderCancelledEmail(email, name, order.id);
      case OrderStatus.DELIVERED:
        return this.mailService.sendOrderDeliveredEmail(email, name, order.id);
    }
  }
}
