import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CouponProductTargetEntity } from '../entities/coupon-product-target.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { CreateCouponProductTargetDto } from '../dto/create-coupon-combo-target.dto';
import { CouponProductTargetResponseDto } from '../dto/coupon-product-target-response.dto';

@Injectable()
export class CouponProductTargetService {

  constructor(
    @InjectRepository(CouponProductTargetEntity)
    private readonly repo: Repository<CouponProductTargetEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    couponId: number,
    dto: CreateCouponProductTargetDto,
  ): Promise<CouponProductTargetResponseDto> {
    // 🔥 una sola query — reutilizamos el coupon en validateCouponNotGlobal
    const coupon = await this.findCoupon(couponId);
    this.validateCouponNotGlobal(coupon);
    await this.validateUniqueTarget(couponId, dto.productId);

    const entity = this.repo.create({
      couponId,
      productId: dto.productId,
    });

    const saved = await this.repo.save(entity);

    return new CouponProductTargetResponseDto(saved);
  }

  // ==========================
  // GET ALL BY COUPON
  // ==========================

  async findAll(couponId: number): Promise<CouponProductTargetResponseDto[]> {
    await this.findCoupon(couponId);

    const targets = await this.repo.find({
      where: { couponId },
    });

    return targets.map((t) => new CouponProductTargetResponseDto(t));
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
        `Product target ${productId} not found for coupon ${couponId}`,
      );
    }

    await this.repo.softDelete(entity.id);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findCoupon(couponId: number): Promise<CouponEntity> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with id ${couponId} not found`);
    }

    return coupon;
  }

  private validateCouponNotGlobal(coupon: CouponEntity): void {
    if (coupon.isGlobal) {
      throw new ConflictException(
        'Cannot assign targets to a global coupon',
      );
    }
  }

  private async validateUniqueTarget(
    couponId: number,
    productId: number,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { couponId, productId },
    });

    if (existing) {
      throw new ConflictException(
        `Product ${productId} is already a target of coupon ${couponId}`,
      );
    }
  }
}