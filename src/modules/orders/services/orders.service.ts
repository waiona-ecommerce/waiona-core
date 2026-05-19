import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { OrderEntity } from '../entities/order.entity';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { OrderItemEntity } from '../entities/order-item.entity';
import { ProductEntity } from 'src/modules/products/product/entities/product.entity';
import { ComboEntity } from 'src/modules/products/combos/entities/combo.entity';
import { CouponEntity } from 'src/modules/coupons/coupon/entities/coupon.entity';
import { CouponUsageEntity } from 'src/modules/coupons/usage/entities/coupon-usage.entity';
import { CouponProductTargetEntity } from 'src/modules/coupons/coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from 'src/modules/coupons/coupon-combo-target/entities/coupon-combo-target.entity';
import { StockItemEntity } from 'src/modules/stocks/stock-item/entities/stock-item.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

import { StockItemsService } from 'src/modules/stocks/stock-item/services/stock-item.service';
import { CalculationService } from 'src/modules/pricing/calculation/services/calculation.service';

import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { OrderStatus } from '../enums/order-status.enum';
import { DeliveryType } from '../enums/delivery-type.enum';

@Injectable()
export class OrdersService {

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

    @InjectRepository(CouponProductTargetEntity)
    private readonly couponProductTargetRepo: Repository<CouponProductTargetEntity>,

    @InjectRepository(CouponComboTargetEntity)
    private readonly couponComboTargetRepo: Repository<CouponComboTargetEntity>,

    private readonly stockItemsService: StockItemsService,
    private readonly calculationService: CalculationService,
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
    if (!user) throw new NotFoundException('User not found');

    // 1. Validar items
    for (const item of dto.items) {
      if (!item.productId && !item.comboId) {
        throw new BadRequestException('Each item must have a productId or comboId');
      }
      if (item.productId && item.comboId) {
        throw new BadRequestException('Each item must have either productId or comboId, not both');
      }
    }

    // 2. Validar dirección si es delivery
    if (dto.deliveryType === DeliveryType.DELIVERY && !dto.address) {
      throw new BadRequestException('Address is required for delivery orders');
    }

    // 3. Calcular precios, validar stock y cupón ANTES de la transacción
    const orderItems: OrderItemEntity[] = [];
    const stockReservations: { productId: number; locationId: number; quantity: number }[] = [];
    let subtotal = 0;
    const couponItems: Array<{ productId?: number; comboId?: number; subtotal: number }> = [];

    for (const item of dto.items) {

      if (item.productId) {
        const product = await this.productRepo.findOne({
          where: { id: item.productId },
        });
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        const stockItem = await this.findAvailableStockItem(item.productId, item.quantity);

        const breakdown = await this.calculationService.calculateProduct({
          productId: item.productId,
        });

        const itemSubtotal = breakdown.finalPrice * item.quantity;

        const orderItem = this.orderItemRepo.create({
          product,
          quantity:   item.quantity,
          unitPrice:  breakdown.unitPrice,
          finalPrice: itemSubtotal,
          locationId: stockItem.locationId,
        });

        orderItems.push(orderItem);
        stockReservations.push({
          productId:  item.productId,
          locationId: stockItem.locationId,
          quantity:   item.quantity,
        });
        subtotal += itemSubtotal;
        couponItems.push({ productId: item.productId, subtotal: itemSubtotal });

      } else if (item.comboId) {
        const combo = await this.comboRepo.findOne({
          where: { id: item.comboId },
          relations: ['items'],
        });
        if (!combo) throw new NotFoundException(`Combo ${item.comboId} not found`);

        const comboReservations: { productId: number; locationId: number; quantity: number }[] = [];

        for (const comboItem of combo.items) {
          const stockItem = await this.findAvailableStockItem(
            comboItem.productId,
            item.quantity * comboItem.quantity,
          );
          const reservation = {
            productId:  comboItem.productId,
            locationId: stockItem.locationId,
            quantity:   item.quantity * comboItem.quantity,
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
          quantity:          item.quantity,
          unitPrice:         breakdown.unitPrice,
          finalPrice:        itemSubtotal,
          comboReservations,
        });

        orderItems.push(orderItem);
        subtotal += itemSubtotal;
        couponItems.push({ comboId: item.comboId, subtotal: itemSubtotal });
      }
    }

    const couponDiscount = dto.couponCode
      ? await this.computeOrderCouponDiscount(dto.couponCode, couponItems)
      : 0;

    const total = Math.max(0, subtotal - couponDiscount);

    // 4. 🔥 Transacción — guardar orden + reservar stock + registrar cupón de forma atómica
    const saved = await this.dataSource.transaction(async manager => {

      // pessimistic lock sobre el cupón — previene race condition (TOCTOU):
      // dos requests concurrentes con el mismo código esperan el lock en lugar de ambas pasar
      let lockedCoupon: CouponEntity | null = null;

      if (dto.couponCode) {
        lockedCoupon = await manager.findOne(CouponEntity, {
          where: { code: dto.couponCode },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedCoupon) throw new NotFoundException('Coupon not found');

        if (lockedCoupon.startsAt && now < lockedCoupon.startsAt)
          throw new BadRequestException('Coupon is not active yet');
        if (lockedCoupon.endsAt && now > lockedCoupon.endsAt)
          throw new BadRequestException('Coupon has expired');
        if (lockedCoupon.usageLimit && lockedCoupon.usageCount >= lockedCoupon.usageLimit)
          throw new BadRequestException('Coupon has reached its usage limit');

        const alreadyUsed = await manager.findOne(CouponUsageEntity, {
          where: { couponId: lockedCoupon.id, userId: user.id },
        });
        if (alreadyUsed) throw new ConflictException('Coupon already used by this user');

        if (couponDiscount === 0) {
          throw new BadRequestException('Coupon does not apply to any item in this order');
        }
      }

      // guardar orden
      const order = manager.create(OrderEntity, {
        user,
        items:          orderItems,
        status:         OrderStatus.PENDING,
        deliveryType:   dto.deliveryType,
        address:        dto.address ?? null,
        notes:          dto.notes ?? null,
        subtotal,
        couponDiscount: couponDiscount > 0 ? couponDiscount : null,
        coupon:         lockedCoupon ?? null,
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
          couponId:  lockedCoupon.id,
          userId:    user.id,
          orderId:   savedOrder.id,
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

  async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const [orders, total] = await this.orderRepo.findAndCount({
      relations: ['user', 'items', 'items.product', 'items.combo', 'coupon'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(orders.map(o => new OrderResponseDto(o)), total, page, limit);
  }

  // ==========================
  // FIND ONE
  // ==========================

  async findOne(id: number): Promise<OrderResponseDto> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product', 'items.combo', 'coupon'],
    });
    if (!order) throw new NotFoundException('Order not found');
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
    return orders.map(o => new OrderResponseDto(o));
  }

  // ==========================
  // UPDATE STATUS
  // ==========================

  async updateStatus(id: number, dto: UpdateOrderStatusDto): Promise<OrderResponseDto> {
    const saved = await this.dataSource.transaction(async manager => {
      const order = await manager.findOne(OrderEntity, {
        where: { id },
        relations: ['user', 'items', 'items.product', 'items.combo', 'coupon'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

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

    return new OrderResponseDto(saved);
  }

  // ==========================
  // PRIVATE — validar transición
  // ==========================

  private validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]:  [OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
      [OrderStatus.DISPATCHED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]:  [],
      [OrderStatus.CANCELLED]:  [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(
        `Cannot transition order from "${current}" to "${next}"`,
      );
    }
  }

  // ==========================
  // RELEASE STOCK (llamado desde pagos al cancelar por webhook)
  // ==========================

  async releaseStockForOrder(orderId: number, manager?: EntityManager): Promise<void> {
    const execute = async (txManager: EntityManager) => {
      const order = await txManager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: ['items', 'items.product', 'items.combo', 'coupon'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) return;
      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) return;
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
      throw new NotFoundException(`No stock found for product ${productId}`);
    }

    // misma lógica que ShopService: la ubicación con más stock disponible
    const best = items.reduce((prev, curr) =>
      curr.quantityAvailable > prev.quantityAvailable ? curr : prev,
    );

    if (best.quantityAvailable < quantity) {
      throw new BadRequestException(`Insufficient stock for product ${productId}`);
    }

    return best;
  }

  // ==========================
  // PRIVATE — descuento de cupón sobre la orden
  // ==========================

  private async computeOrderCouponDiscount(
    couponCode: string,
    items: Array<{ productId?: number; comboId?: number; subtotal: number }>,
  ): Promise<number> {
    const now = new Date();

    const coupon = await this.couponRepo.findOne({ where: { code: couponCode } });
    if (!coupon) return 0;
    if (coupon.startsAt && now < coupon.startsAt) return 0;
    if (coupon.endsAt && now > coupon.endsAt) return 0;
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return 0;

    const apply = (base: number) =>
      coupon.isPercentage ? base * (coupon.value / 100) : coupon.value;

    if (coupon.isGlobal) {
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      return apply(total);
    }

    let eligibleSubtotal = 0;
    for (const item of items) {
      if (item.productId) {
        const target = await this.couponProductTargetRepo.findOne({
          where: { couponId: coupon.id, productId: item.productId },
        });
        if (target) eligibleSubtotal += item.subtotal;
      }
      if (item.comboId) {
        const target = await this.couponComboTargetRepo.findOne({
          where: { couponId: coupon.id, comboId: item.comboId },
        });
        if (target) eligibleSubtotal += item.subtotal;
      }
    }

    if (eligibleSubtotal === 0) return 0;
    return apply(eligibleSubtotal);
  }

  // ==========================
  // PRIVATE — despachar
  // ==========================

  private async handleDispatch(order: OrderEntity, manager: EntityManager): Promise<void> {
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

  private async handleCancellation(order: OrderEntity, manager: EntityManager): Promise<void> {
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

    if (order.coupon) {
      const couponRepo = manager.getRepository(CouponEntity);
      const usageRepo  = manager.getRepository(CouponUsageEntity);
      order.coupon.usageCount = Math.max(0, order.coupon.usageCount - 1);
      await couponRepo.save(order.coupon);
      await usageRepo.softDelete({ couponId: order.coupon.id, orderId: order.id });
    }
  }
}