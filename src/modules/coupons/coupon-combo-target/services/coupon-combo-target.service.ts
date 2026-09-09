import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { PG_UNIQUE_VIOLATION } from '../../../../common/constants/postgres-error-codes';
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

    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    couponId: number,
    dto: CreateCouponComboTargetDto,
  ): Promise<CouponComboTargetResponseDto> {
    // Se lockea el cupón porque CouponService.update() compite por la misma
    // fila al chequear "sin targets" antes de marcar el cupón como global.
    const saved = await this.dataSource.transaction(async (manager) => {
      const coupon = await this.findCoupon(couponId, manager);
      this.validateCouponNotGlobal(coupon);
      this.validateCouponUsable(coupon);
      await this.validateComboExists(dto.comboId, manager);
      await this.validateUniqueTarget(couponId, dto.comboId, manager);

      const entity = manager.create(CouponComboTargetEntity, {
        couponId,
        comboId: dto.comboId,
      });

      try {
        return await manager.save(CouponComboTargetEntity, entity);
      } catch (err: any) {
        if (err.code === PG_UNIQUE_VIOLATION) {
          throw new ConflictException(
            `El combo ${dto.comboId} ya es un target del cupón ${couponId}`,
          );
        }
        throw err;
      }
    });

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

  private async validateComboExists(
    comboId: number,
    manager: EntityManager,
  ): Promise<void> {
    const combo = await manager.findOne(ComboEntity, {
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
    manager: EntityManager,
  ): Promise<void> {
    const existing = await manager.findOne(CouponComboTargetEntity, {
      where: { couponId, comboId },
    });

    if (existing) {
      throw new ConflictException(
        `El combo ${comboId} ya es un target del cupón ${couponId}`,
      );
    }
  }
}
