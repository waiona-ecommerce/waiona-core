import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DiscountEntity } from '../entities/discounts.entity';
import { DiscountStatus } from '../enums/discount-status.enum';

export class DiscountResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Black Friday' })
  name: string;

  @ApiPropertyOptional({ example: 'Descuento de temporada' })
  description?: string;

  @ApiProperty({ enum: DiscountStatus, example: DiscountStatus.ACTIVE })
  status: DiscountStatus;

  @ApiProperty({ example: 10 })
  value: number;

  @ApiPropertyOptional({ example: '2025-11-01T00:00:00.000Z' })
  startsAt?: Date;

  @ApiPropertyOptional({ example: '2025-11-30T23:59:59.000Z' })
  endsAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: DiscountEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.description = entity.description ?? undefined;

    this.value = Number(entity.value);

    this.startsAt = entity.startsAt ?? undefined;
    this.endsAt = entity.endsAt ?? undefined;

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;

    this.status = this.calculateStatus(entity);
  }

  private calculateStatus(entity: DiscountEntity): DiscountStatus {
    const now = new Date();
    const { startsAt, endsAt } = entity;

    if (startsAt && endsAt && endsAt < startsAt) {
      return DiscountStatus.EXPIRED;
    }

    if (endsAt && now > endsAt) {
      return DiscountStatus.EXPIRED;
    }

    if (startsAt && now < startsAt) {
      return DiscountStatus.SCHEDULED;
    }

    return DiscountStatus.ACTIVE;
  }
}
