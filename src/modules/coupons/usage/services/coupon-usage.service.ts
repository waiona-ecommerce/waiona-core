import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { CouponUsageEntity } from '../entities/coupon-usage.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { CouponProductTargetEntity } from '../../coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from '../../coupon-combo-target/entities/coupon-combo-target.entity';
import { UserEntity } from '../../../users/entities/user.entity';
import { CouponUsageResponseDto } from '../dto/coupon-usage-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

export interface CouponUsageItem {
  productId?: number;
  comboId?: number;
  subtotal: number;
}

// Dueño de toda la lógica de negocio de "usar un cupón": vigencia, límite de
// uso, elegibilidad por target y cálculo del descuento. Quien consume esto
// (OrdersService) le pasa el `manager` de su propia transacción — así el
// lock de la fila del cupón queda dentro de la misma transacción que
// lockea la orden, sin que este service necesite conocer nada de OrderEntity.
@Injectable()
export class CouponUsageService {
  constructor(
    @InjectRepository(CouponUsageEntity)
    private readonly repo: Repository<CouponUsageEntity>,

    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  // ==========================
  // VALIDAR + CALCULAR DESCUENTO (dentro de una transacción ajena)
  // ==========================

  async validateAndComputeDiscount(
    code: string,
    userId: number,
    items: CouponUsageItem[],
    manager: EntityManager,
  ): Promise<{ coupon: CouponEntity; discount: number }> {
    const now = new Date();

    // Lock del cupón — serializa concurrencia y garantiza datos frescos
    const coupon = await manager.findOne(CouponEntity, {
      where: { code },
      lock: { mode: 'pessimistic_write' },
    });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');

    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('El cupón aún no está vigente');
    }
    if (coupon.endsAt && now > coupon.endsAt) {
      throw new BadRequestException('El cupón ha expirado');
    }
    if (
      coupon.usageLimit !== null &&
      coupon.usageLimit !== undefined &&
      coupon.usageCount >= coupon.usageLimit
    ) {
      throw new BadRequestException('El cupón ha alcanzado su límite de usos');
    }

    const alreadyUsed = await manager.findOne(CouponUsageEntity, {
      where: { couponId: coupon.id, userId },
    });
    if (alreadyUsed) {
      throw new ConflictException('El usuario ya utilizó este cupón');
    }

    const discount = await this.computeDiscount(coupon, items, manager);
    if (discount === 0) {
      throw new BadRequestException(
        'El cupón no aplica a ningún ítem de esta orden',
      );
    }

    return { coupon, discount };
  }

  // ==========================
  // REGISTRAR USO (dentro de la misma transacción, ya con orderId)
  // ==========================

  async recordUsage(
    coupon: CouponEntity,
    userId: number,
    orderId: number,
    manager: EntityManager,
  ): Promise<void> {
    coupon.usageCount += 1;
    await manager.save(CouponEntity, coupon);

    const usage = manager.create(CouponUsageEntity, {
      couponId: coupon.id,
      userId,
      orderId,
      appliedAt: new Date(),
    });
    await manager.save(CouponUsageEntity, usage);
  }

  // ==========================
  // LIBERAR USO (al cancelar la orden)
  // ==========================

  async releaseUsage(
    couponId: number,
    orderId: number,
    manager: EntityManager,
  ): Promise<void> {
    // Re-leer con lock para evitar lost update si dos cancelaciones son concurrentes
    const coupon = await manager.findOne(CouponEntity, {
      where: { id: couponId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!coupon) return;

    coupon.usageCount = Math.max(0, coupon.usageCount - 1);
    await manager.save(CouponEntity, coupon);
    await manager.softDelete(CouponUsageEntity, {
      couponId: coupon.id,
      orderId,
    });
  }

  // ==========================
  // PRIVATE — descuento de cupón sobre los ítems
  // ==========================

  private async computeDiscount(
    coupon: CouponEntity,
    items: CouponUsageItem[],
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
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<CouponUsageResponseDto>> {
    const [usages, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      usages.map((u) => new CouponUsageResponseDto(u)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY COUPON
  // ==========================

  async findByCoupon(couponId: number): Promise<CouponUsageResponseDto[]> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });
    if (!coupon) {
      throw new NotFoundException(`Cupón con id ${couponId} no encontrado`);
    }

    const usages = await this.repo.find({
      where: { couponId },
      order: { createdAt: 'DESC' },
    });
    return usages.map((u) => new CouponUsageResponseDto(u));
  }

  // ==========================
  // GET BY USER
  // ==========================

  async findByUser(userId: number): Promise<CouponUsageResponseDto[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${userId} no encontrado`);
    }

    const usages = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return usages.map((u) => new CouponUsageResponseDto(u));
  }
}
