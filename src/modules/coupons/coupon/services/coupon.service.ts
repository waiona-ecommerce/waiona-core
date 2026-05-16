import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CouponEntity } from '../entities/coupon.entity';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { CouponResponseDto } from '../dto/coupon-response.dto';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateCouponDto): Promise<CouponResponseDto> {
    this.validateDates(dto.startsAt, dto.endsAt);

    const normalized = this.normalizeCoupon({
      value: dto.value,
      isPercentage: dto.isPercentage,
      currency: dto.currency,
    });

    this.validateValue(
      normalized.value,
      normalized.isPercentage,
      normalized.currency,
      dto.currency,
    );

    await this.validateUniqueCode(dto.code);

    const coupon = this.couponRepository.create({
      code: dto.code,
      isGlobal: dto.isGlobal,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      usageLimit: dto.usageLimit ?? null,
      usageCount: 0,
      value: normalized.value,
      isPercentage: normalized.isPercentage,
      currency: normalized.currency ?? null,
    });

    const saved = await this.couponRepository.save(coupon);

    return new CouponResponseDto(saved);
  }

  // ==========================
  // GET ALL
  // ==========================

  async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<CouponResponseDto>> {
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
    const coupon = await this.findEntity(id);

    if (dto.code && dto.code !== coupon.code) {
      await this.validateUniqueCode(dto.code);
    }

    const value = Number(dto.value ?? coupon.value);
    const isPercentage = dto.isPercentage ?? coupon.isPercentage;
    const currency = dto.currency ?? coupon.currency;

    const startsAt = dto.startsAt ?? coupon.startsAt;
    const endsAt = dto.endsAt ?? coupon.endsAt;

    this.validateDates(startsAt, endsAt);

    const normalized = this.normalizeCoupon({ value, isPercentage, currency });

    this.validateValue(
      normalized.value,
      normalized.isPercentage,
      normalized.currency,
      dto.currency,
    );

    coupon.code = dto.code ?? coupon.code;
    coupon.isGlobal = dto.isGlobal ?? coupon.isGlobal;
    coupon.value = normalized.value;
    coupon.isPercentage = normalized.isPercentage;
    coupon.currency = normalized.currency ?? null;
    coupon.usageLimit = dto.usageLimit ?? coupon.usageLimit;
    coupon.startsAt = startsAt ?? null;
    coupon.endsAt = endsAt ?? null;

    const updated = await this.couponRepository.save(coupon);

    return new CouponResponseDto(updated);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(id: number): Promise<void> {
    const coupon = await this.findEntity(id);
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
      throw new NotFoundException(`Coupon with id ${id} not found`);
    }

    return coupon;
  }

  private async validateUniqueCode(code: string): Promise<void> {
    const existing = await this.couponRepository.findOne({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Coupon with code "${code}" already exists`);
    }
  }

  private validateDates(startsAt?: Date | null, endsAt?: Date | null): void {
    if (startsAt && endsAt) {
      if (new Date(startsAt) >= new Date(endsAt)) {
        throw new BadRequestException('startsAt must be before endsAt');
      }
    }
  }

  private validateValue(
    value: number,
    isPercentage: boolean,
    currency?: CurrencyCode | null,
    rawCurrency?: CurrencyCode | null,
  ): void {
    if (isPercentage) {
      if (value > 100) {
        throw new BadRequestException('Percentage coupon cannot exceed 100');
      }
      if (rawCurrency) {
        throw new BadRequestException(
          'currency must not be present when isPercentage is true',
        );
      }
    } else {
      if (!currency) {
        throw new BadRequestException(
          'Fixed amount coupon requires a currency',
        );
      }
    }
  }

  private normalizeCoupon({
    value,
    isPercentage,
    currency,
  }: {
    value: number;
    isPercentage: boolean;
    currency?: CurrencyCode | null;
  }) {
    return {
      value,
      isPercentage,
      currency: isPercentage ? null : currency,
    };
  }
}
