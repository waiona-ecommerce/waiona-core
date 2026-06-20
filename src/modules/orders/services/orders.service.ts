import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';

import { OrderEntity } from '../entities/order.entity';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { OrderItemEntity } from '../entities/order-item.entity';
import { ProductEntity } from '../../products/product/entities/product.entity';
import { ComboEntity } from '../../products/combos/entities/combo.entity';
import { CouponEntity } from '../../coupons/coupon/entities/coupon.entity';
import { CouponUsageEntity } from '../../coupons/usage/entities/coupon-usage.entity';
import { CouponProductTargetEntity } from '../../coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from '../../coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { StockItemEntity } from '../../stocks/stock-item/entities/stock-item.entity';
import { UserEntity } from '../../users/entities/user.entity';

import { StockItemsService } from '../../stocks/stock-item/services/stock-item.service';
import { CalculationService } from '../../pricing/calculation/services/calculation.service';
import { MailService } from '../../mail/services/mail.service';

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

    @InjectRepository(CouponEntity)
    private readonly couponRepo: Repository<CouponEntity>,

    private readonly stockItemsService: StockItemsService,
    private readonly calculationService: CalculationService,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(userId: number, dto: CreateOrderDto): Promise<OrderResponseDto> {
    const now = new Date();

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

    // 3. Calcular precios, validar stock y cupón ANTES de la transacción
    const orderItems: OrderItemEntity[] = [];
    const stockReservations: {
      productId: number;
      locationId: number;
      quantity: number;
    }[] = [];
    let subtotal = 0;
    const couponItems: Array<{
      productId?: number;
      comboId?: number;
      subtotal: number;
    }> = [];

    for (const item of dto.items) {
      if (item.productId) {
        const product = await this.productRepo.findOne({
          where: { id: item.productId },
        });
        if (!product)
          throw new NotFoundException(
            `Producto con id ${item.productId} no encontrado`,
          );

        const stockItem = await this.findAvailableStockItem(
          item.productId,
          item.quantity,
        );

        const breakdown = await this.calculationService.calculateProduct({
          productId: item.productId,
        });

        const itemSubtotal = breakdown.finalPrice * item.quantity;

        const orderItem = this.orderItemRepo.create({
          product,
          quantity: item.quantity,
          unitPrice: breakdown.unitPrice,
          finalPrice: itemSubtotal,
          locationId: stockItem.locationId,
        });

        orderItems.push(orderItem);
        stockReservations.push({
          productId: item.productId,
          locationId: stockItem.locationId,
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

        const comboReservations: {
          productId: number;
          locationId: number;
          quantity: number;
        }[] = [];

        for (const comboItem of combo.items) {
          const stockItem = await this.findAvailableStockItem(
            comboItem.productId,
            item.quantity * comboItem.quantity,
          );
          const reservation = {
            productId: comboItem.productId,
            locationId: stockItem.locationId,
            quantity: item.quantity * comboItem.quantity,
          };
          comboReservations.push(reservation);
          stockReservations.push(reservation);
        }

        const breakdown = await this.calculationService.calculateCombo({
          comboId: item.comboId,
        });

        const itemSubtotal = breakdown.finalPrice * item.quantity;

        const orderItem = this.orderItemRepo.create({
          combo,
          quantity: item.quantity,
          unitPrice: breakdown.unitPrice,
          finalPrice: itemSubtotal,
          comboReservations,
        });

        orderItems.push(orderItem);
        subtotal += itemSubtotal;
        couponItems.push({ comboId: item.comboId, subtotal: itemSubtotal });
      }
    }

    // 4. 🔥 Transacción — guardar orden + reservar stock + registrar cupón de forma atómica
    const saved = await this.dataSource.transaction(async (manager) => {
      let lockedCoupon: CouponEntity | null = null;
      let couponDiscount = 0;

      if (dto.couponCode) {
        // Lock del cupón primero — serializa concurrencia y garantiza datos frescos
        lockedCoupon = await manager.findOne(CouponEntity, {
          where: { code: dto.couponCode },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedCoupon) throw new NotFoundException('Cupón no encontrado');

        if (lockedCoupon.startsAt && now < lockedCoupon.startsAt)
          throw new BadRequestException('El cupón aún no está vigente');
        if (lockedCoupon.endsAt && now > lockedCoupon.endsAt)
          throw new BadRequestException('El cupón ha expirado');
        if (
          lockedCoupon.usageLimit !== null &&
          lockedCoupon.usageLimit !== undefined &&
          lockedCoupon.usageCount >= lockedCoupon.usageLimit
        )
          throw new BadRequestException(
            'El cupón ha alcanzado su límite de usos',
          );

        const alreadyUsed = await manager.findOne(CouponUsageEntity, {
          where: { couponId: lockedCoupon.id, userId: user.id },
        });
        if (alreadyUsed)
          throw new ConflictException('El usuario ya utilizó este cupón');

        // Calcular descuento con datos frescos del cupón ya locked
        couponDiscount = await this.computeCouponDiscountWithManager(
          lockedCoupon,
          couponItems,
          manager,
        );

        if (couponDiscount === 0) {
          throw new BadRequestException(
            'El cupón no aplica a ningún ítem de esta orden',
          );
        }
      }

      const total = Math.max(0, subtotal - couponDiscount);

      // guardar orden
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

      // reservar stock — atómico con el save de la orden
      for (const reservation of stockReservations) {
        await this.stockItemsService.reserveStock(
          reservation.productId,
          reservation.locationId,
          reservation.quantity,
          manager,
        );
      }

      // registrar uso del cupón — solo si efectivamente generó descuento
      if (lockedCoupon && couponDiscount > 0) {
        lockedCoupon.usageCount += 1;
        await manager.save(CouponEntity, lockedCoupon);

        const usage = manager.create(CouponUsageEntity, {
          couponId: lockedCoupon.id,
          userId: user.id,
          orderId: savedOrder.id,
          appliedAt: now,
        });
        await manager.save(CouponUsageEntity, usage);
      }

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
      await this.handleCancellation(order, txManager);
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
  ): Promise<StockItemEntity> {
    const items = await this.stockItemRepo.find({
      where: { productId },
    });

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
  // PRIVATE — descuento de cupón sobre la orden
  // ==========================

  private async computeCouponDiscountWithManager(
    coupon: CouponEntity,
    items: Array<{ productId?: number; comboId?: number; subtotal: number }>,
    manager: EntityManager,
  ): Promise<number> {
    const apply = (base: number) => base * (coupon.value / 100);

    if (coupon.isGlobal) {
      return apply(items.reduce((sum, i) => sum + i.subtotal, 0));
    }

    const productIds = items.flatMap((i) => (i.productId ? [i.productId] : []));
    const comboIds = items.flatMap((i) => (i.comboId ? [i.comboId] : []));

    const [productTargets, comboTargets] = await Promise.all([
      productIds.length
        ? manager.find(CouponProductTargetEntity, {
            where: { couponId: coupon.id, productId: In(productIds) },
          })
        : Promise.resolve([]),
      comboIds.length
        ? manager.find(CouponComboTargetEntity, {
            where: { couponId: coupon.id, comboId: In(comboIds) },
          })
        : Promise.resolve([]),
    ]);

    const eligibleProductIds = new Set(productTargets.map((t) => t.productId));
    const eligibleComboIds = new Set(comboTargets.map((t) => t.comboId));

    const eligibleSubtotal = items.reduce((sum, i) => {
      if (i.productId && eligibleProductIds.has(i.productId))
        return sum + i.subtotal;
      if (i.comboId && eligibleComboIds.has(i.comboId)) return sum + i.subtotal;
      return sum;
    }, 0);

    return eligibleSubtotal === 0 ? 0 : apply(eligibleSubtotal);
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
  ): Promise<void> {
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
      // Re-leer con lock para evitar lost update si dos cancelaciones son concurrentes
      const coupon = await manager.findOne(CouponEntity, {
        where: { id: order.couponId },
        lock: { mode: 'pessimistic_write' },
      });
      if (coupon) {
        coupon.usageCount = Math.max(0, coupon.usageCount - 1);
        await manager.save(CouponEntity, coupon);
        await manager.softDelete(CouponUsageEntity, {
          couponId: coupon.id,
          orderId: order.id,
        });
      }
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
