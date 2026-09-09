import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { PG_UNIQUE_VIOLATION } from '../../../../common/constants/postgres-error-codes';
import { CouponEntity } from '../entities/coupon.entity';
import { CouponUsageEntity } from '../../usage/entities/coupon-usage.entity';
import { CouponProductTargetEntity } from '../../coupon-product-target/entities/coupon-product-target.entity';
import { CouponComboTargetEntity } from '../../coupon-combo-target/entities/coupon-combo-target.entity';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { CouponResponseDto } from '../dto/coupon-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,

    @InjectRepository(CouponUsageEntity)
    private readonly couponUsageRepository: Repository<CouponUsageEntity>,

    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateCouponDto): Promise<CouponResponseDto> {
    this.validateDates(dto.startsAt, dto.endsAt);
    await this.validateUniqueCode(dto.code);

    const coupon = this.couponRepository.create({
      code: dto.code,
      isGlobal: dto.isGlobal,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      usageLimit: dto.usageLimit ?? null,
      usageCount: 0,
      value: dto.value,
    });

    try {
      const saved = await this.couponRepository.save(coupon);
      return new CouponResponseDto(saved);
    } catch (err: any) {
      if (err.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          `Ya existe un cupón con el código "${dto.code}"`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<CouponResponseDto>> {
    const [coupons, total] = await this.couponRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      coupons.map((coupon) => new CouponResponseDto(coupon)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET ONE
  // ==========================

  async findOne(id: number): Promise<CouponResponseDto> {
    const coupon = await this.findEntity(id);
    return new CouponResponseDto(coupon);
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, dto: UpdateCouponDto): Promise<CouponResponseDto> {
    // Se lockea la fila del cupón porque el chequeo "sin targets" de más
    // abajo compite con CouponProductTargetService/CouponComboTargetService
    // .create(), que lockean el mismo cupón antes de insertar un target.
    const updated = await this.dataSource.transaction(async (manager) => {
      const coupon = await manager.findOne(CouponEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!coupon) {
        throw new NotFoundException(`Cupón con id ${id} no encontrado`);
      }

      if (dto.code && dto.code !== coupon.code) {
        const existing = await manager.findOne(CouponEntity, {
          where: { code: dto.code },
        });
        if (existing) {
          throw new ConflictException(
            `Ya existe un cupón con el código "${dto.code}"`,
          );
        }
      }

      // Usar !== undefined para permitir nullear explícitamente fechas y límite
      const startsAt =
        dto.startsAt !== undefined ? dto.startsAt : coupon.startsAt;
      const endsAt = dto.endsAt !== undefined ? dto.endsAt : coupon.endsAt;

      this.validateDates(startsAt, endsAt);

      const newUsageLimit =
        dto.usageLimit !== undefined ? dto.usageLimit : coupon.usageLimit;

      if (
        newUsageLimit !== null &&
        newUsageLimit !== undefined &&
        newUsageLimit < coupon.usageCount
      ) {
        throw new BadRequestException(
          `El límite de uso (${newUsageLimit}) no puede ser menor que el uso actual (${coupon.usageCount})`,
        );
      }

      if (dto.isGlobal === true && !coupon.isGlobal) {
        const [productTargets, comboTargets] = await Promise.all([
          manager.count(CouponProductTargetEntity, {
            where: { couponId: coupon.id },
          }),
          manager.count(CouponComboTargetEntity, {
            where: { couponId: coupon.id },
          }),
        ]);
        if (productTargets > 0 || comboTargets > 0) {
          throw new BadRequestException(
            'No se puede marcar como global un cupón que ya tiene productos o combos asignados; quítelos primero',
          );
        }
      }

      coupon.code = dto.code ?? coupon.code;
      coupon.isGlobal = dto.isGlobal ?? coupon.isGlobal;
      coupon.value = Number(dto.value ?? coupon.value);
      coupon.usageLimit = newUsageLimit;
      coupon.startsAt = startsAt ?? null;
      coupon.endsAt = endsAt ?? null;

      try {
        return await manager.save(CouponEntity, coupon);
      } catch (err: any) {
        if (err.code === PG_UNIQUE_VIOLATION) {
          throw new ConflictException(
            `Ya existe un cupón con el código "${coupon.code}"`,
          );
        }
        throw err;
      }
    });

    return new CouponResponseDto(updated);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(id: number): Promise<void> {
    const coupon = await this.findEntity(id);

    const usageCount = await this.couponUsageRepository.count({
      where: { couponId: coupon.id },
    });
    if (usageCount > 0) {
      throw new ConflictException(
        'El cupón ya fue utilizado en órdenes y no puede eliminarse',
      );
    }

    await this.couponRepository.softDelete(coupon.id);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findEntity(id: number): Promise<CouponEntity> {
    const coupon = await this.couponRepository.findOne({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException(`Cupón con id ${id} no encontrado`);
    }

    return coupon;
  }

  private async validateUniqueCode(code: string): Promise<void> {
    const existing = await this.couponRepository.findOne({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Ya existe un cupón con el código "${code}"`);
    }
  }

  private validateDates(startsAt?: Date | null, endsAt?: Date | null): void {
    if (startsAt && endsAt) {
      if (new Date(startsAt) >= new Date(endsAt)) {
        throw new BadRequestException(
          'La fecha de inicio debe ser anterior a la fecha de fin',
        );
      }
    }
  }
}
