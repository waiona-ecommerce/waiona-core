import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CouponComboTargetEntity } from '../entities/coupon-combo-target.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';
import { CreateCouponComboTargetDto } from '../dto/create-coupon-combo-target.dto';
import { CouponComboTargetResponseDto } from '../dto/coupon-combo-target-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class CouponComboTargetService {
  constructor(
    @InjectRepository(CouponComboTargetEntity)
    private readonly repo: Repository<CouponComboTargetEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    couponId: number,
    dto: CreateCouponComboTargetDto,
  ): Promise<CouponComboTargetResponseDto> {
    const coupon = await this.findCoupon(couponId);
    this.validateCouponNotGlobal(coupon);
    this.validateCouponUsable(coupon);
    await this.validateComboExists(dto.comboId);
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

  async findAll(
    couponId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<CouponComboTargetResponseDto>> {
    await this.findCoupon(couponId);

    const [targets, total] = await this.repo.findAndCount({
      where: { couponId },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      targets.map((t) => new CouponComboTargetResponseDto(t)),
      total,
      page,
      limit,
    );
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
        `El combo ${comboId} no está asignado al cupón ${couponId}`,
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
      throw new NotFoundException(`Cupón con id ${couponId} no encontrado`);
    }

    return coupon;
  }

  private async validateComboExists(comboId: number): Promise<void> {
    const combo = await this.comboRepository.findOne({
      where: { id: comboId },
    });

    if (!combo) {
      throw new NotFoundException(`Combo con id ${comboId} no encontrado`);
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
    comboId: number,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { couponId, comboId },
    });

    if (existing) {
      throw new ConflictException(
        `El combo ${comboId} ya es un target del cupón ${couponId}`,
      );
    }
  }
}
