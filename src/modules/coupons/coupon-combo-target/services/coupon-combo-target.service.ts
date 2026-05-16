import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CouponComboTargetEntity } from '../entities/coupon-combo-target.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { CreateCouponComboTargetDto } from '../dto/create-coupon-combo-target.dto';
import { CouponComboTargetResponseDto } from '../dto/coupon-combo-target-response.dto';

@Injectable()
export class CouponComboTargetService {

  constructor(
    @InjectRepository(CouponComboTargetEntity)
    private readonly repo: Repository<CouponComboTargetEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    couponId: number,
    dto: CreateCouponComboTargetDto,
  ): Promise<CouponComboTargetResponseDto> {
    // 🔥 una sola query — reutilizamos el coupon en validateCouponNotGlobal
    const coupon = await this.findCoupon(couponId);
    this.validateCouponNotGlobal(coupon);
    await this.validateUniqueTarget(couponId, dto.comboId);

    const entity = this.repo.create({
      couponId,
      comboId: dto.comboId,
    });

    const saved = await this.repo.save(entity);

    return new CouponComboTargetResponseDto(saved);
  }

  // ==========================
  // GET ALL BY COUPON
  // ==========================

  async findAll(couponId: number): Promise<CouponComboTargetResponseDto[]> {
    await this.findCoupon(couponId);

    const targets = await this.repo.find({
      where: { couponId },
    });

    return targets.map((t) => new CouponComboTargetResponseDto(t));
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(couponId: number, comboId: number): Promise<void> {
    await this.findCoupon(couponId);

    const entity = await this.repo.findOne({
      where: { couponId, comboId },
    });

    if (!entity) {
      throw new NotFoundException(
        `Combo target ${comboId} not found for coupon ${couponId}`,
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
    comboId: number,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { couponId, comboId },
    });

    if (existing) {
      throw new ConflictException(
        `Combo ${comboId} is already a target of coupon ${couponId}`,
      );
    }
  }
}