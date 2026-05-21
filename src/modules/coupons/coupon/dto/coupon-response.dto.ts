import { ApiProperty } from '@nestjs/swagger';

import { CouponEntity } from '../entities/coupon.entity';
import { CouponStatus } from '../enums/coupon-status.enum';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

export class CouponResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'PROMO10' })
  code: string;

  @ApiProperty({ enum: CouponStatus, example: CouponStatus.ACTIVE })
  status: CouponStatus;

  @ApiProperty({ example: 10 })
  value: number;

  @ApiProperty({ example: true })
  isPercentage: boolean;

  @ApiProperty({
    enum: CurrencyCode,
    required: false,
    nullable: true,
    example: 'ARS',
  })
  currency?: CurrencyCode;

  @ApiProperty({ example: false })
  isGlobal: boolean;

  @ApiProperty({ required: false, nullable: true, example: 100 })
  usageLimit?: number;

  @ApiProperty({ example: 0 })
  usageCount: number;

  @ApiProperty({ required: false, nullable: true })
  startsAt?: Date;

  @ApiProperty({ required: false, nullable: true })
  endsAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: CouponEntity) {
    this.id = entity.id;
    this.code = entity.code;

    this.value = Number(entity.value);
    this.isPercentage = entity.isPercentage;
    this.currency = entity.currency ?? undefined;

    this.isGlobal = entity.isGlobal;

    this.usageLimit = entity.usageLimit ?? undefined;
    this.usageCount = entity.usageCount;

    this.startsAt = entity.startsAt ?? undefined;
    this.endsAt = entity.endsAt ?? undefined;

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;

    this.status = this.calculateStatus(entity);
  }

  private calculateStatus(entity: CouponEntity): CouponStatus {
    const now = new Date();
    const { startsAt, endsAt, usageLimit, usageCount } = entity;

    if (startsAt && endsAt && endsAt < startsAt) {
      return CouponStatus.EXPIRED;
    }

    if (
      usageLimit !== null &&
      usageLimit !== undefined &&
      usageCount >= usageLimit
    ) {
      return CouponStatus.EXHAUSTED;
    }

    if (endsAt && now > endsAt) {
      return CouponStatus.EXPIRED;
    }

    if (startsAt && now < startsAt) {
      return CouponStatus.SCHEDULED;
    }

    return CouponStatus.ACTIVE;
  }
}
