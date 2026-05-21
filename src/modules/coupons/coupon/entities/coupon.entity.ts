import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

@Entity('coupons')
@Index(['startsAt'])
@Index(['endsAt'])
export class CouponEntity extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    unique: true,
  })
  code: string;

  // ==========================
  // VALOR
  // ==========================

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  value: number;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  isPercentage: boolean;

  @Column({
    type: 'enum',
    enum: CurrencyCode,
    nullable: true,
    default: null,
  })
  currency?: CurrencyCode | null;

  // ==========================
  // ALCANCE
  // ==========================

  @Column({
    name: 'is_global',
    type: 'boolean',
    nullable: false,
    default: false, // 🔥 false = no configurado aún o tiene targets específicos
  })
  isGlobal: boolean;

  // ==========================
  // USO
  // ==========================

  @Column({
    name: 'usage_limit',
    type: 'int',
    nullable: true,
    default: null,
  })
  usageLimit?: number | null;

  @Column({
    name: 'usage_count',
    type: 'int',
    nullable: false,
    default: 0,
  })
  usageCount: number;

  // ==========================
  // FECHAS
  // ==========================

  @Column({
    name: 'starts_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  startsAt?: Date | null;

  @Column({
    name: 'ends_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  endsAt?: Date | null;
}
