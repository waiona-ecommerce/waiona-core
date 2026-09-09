import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { PG_UNIQUE_VIOLATION } from '../../../../common/constants/postgres-error-codes';
import { CouponProductTargetEntity } from '../entities/coupon-product-target.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';
import { CreateCouponProductTargetDto } from '../dto/create-coupon-product-target.dto';
import { CouponProductTargetResponseDto } from '../dto/coupon-product-target-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class CouponProductTargetService {
  constructor(
    @InjectRepository(CouponProductTargetEntity)
    private readonly repo: Repository<CouponProductTargetEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,

    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    couponId: number,
    dto: CreateCouponProductTargetDto,
  ): Promise<CouponProductTargetResponseDto> {
    // Se lockea el cupón porque CouponService.update() compite por la misma
    // fila al chequear "sin targets" antes de marcar el cupón como global.
    const saved = await this.dataSource.transaction(async (manager) => {
      const coupon = await this.findCoupon(couponId, manager);
      this.validateCouponNotGlobal(coupon);
      this.validateCouponUsable(coupon);
      await this.validateProductExists(dto.productId, manager);
      await this.validateUniqueTarget(couponId, dto.productId, manager);

      const entity = manager.create(CouponProductTargetEntity, {
        couponId,
        productId: dto.productId,
      });

      try {
        return await manager.save(CouponProductTargetEntity, entity);
      } catch (err: any) {
        if (err.code === PG_UNIQUE_VIOLATION) {
          throw new ConflictException(
            `El producto ${dto.productId} ya es un target del cupón ${couponId}`,
          );
        }
        throw err;
      }
    });

    return new CouponProductTargetResponseDto(saved);
  }

  // ==========================
  // GET ALL BY COUPON
  // ==========================

  async findAll(
    couponId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<CouponProductTargetResponseDto>> {
    await this.findCoupon(couponId);

    const [targets, total] = await this.repo.findAndCount({
      where: { couponId },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      targets.map((t) => new CouponProductTargetResponseDto(t)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(couponId: number, productId: number): Promise<void> {
    await this.findCoupon(couponId);

    const entity = await this.repo.findOne({
      where: { couponId, productId },
    });

    if (!entity) {
      throw new NotFoundException(
        `El producto ${productId} no está asignado al cupón ${couponId}`,
      );
    }

    await this.repo.softDelete(entity.id);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findCoupon(
    couponId: number,
    manager?: EntityManager,
  ): Promise<CouponEntity> {
    const coupon = manager
      ? await manager.findOne(CouponEntity, {
          where: { id: couponId },
          lock: { mode: 'pessimistic_write' },
        })
      : await this.couponRepository.findOne({ where: { id: couponId } });

    if (!coupon) {
      throw new NotFoundException(`Cupón con id ${couponId} no encontrado`);
    }

    return coupon;
  }

  private async validateProductExists(
    productId: number,
    manager: EntityManager,
  ): Promise<void> {
    const product = await manager.findOne(ProductEntity, {
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Producto con id ${productId} no encontrado`);
    }
  }

  private validateCouponNotGlobal(coupon: CouponEntity): void {
    if (coupon.isGlobal) {
      throw new ConflictException(
        'No se pueden asignar targets a un cupón global',
      );
    }
  }

  private validateCouponUsable(coupon: CouponEntity): void {
    const now = new Date();
    if (coupon.endsAt && now > coupon.endsAt) {
      throw new BadRequestException(
        'No se pueden asignar targets a un cupón expirado',
      );
    }
    if (
      coupon.usageLimit !== null &&
      coupon.usageLimit !== undefined &&
      coupon.usageCount >= coupon.usageLimit
    ) {
      throw new BadRequestException(
        'No se pueden asignar targets a un cupón agotado',
      );
    }
  }

  private async validateUniqueTarget(
    couponId: number,
    productId: number,
    manager: EntityManager,
  ): Promise<void> {
    const existing = await manager.findOne(CouponProductTargetEntity, {
      where: { couponId, productId },
    });

    if (existing) {
      throw new ConflictException(
        `El producto ${productId} ya es un target del cupón ${couponId}`,
      );
    }
  }
}
