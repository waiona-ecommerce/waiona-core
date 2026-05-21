import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';

@Entity('coupon_combo_targets')
@Index(['couponId'])
@Index(['comboId'])
@Index(['couponId', 'comboId'], { unique: true })
export class CouponComboTargetEntity extends BaseEntity {
  @Column({
    name: 'coupon_id',
    type: 'int',
    nullable: false,
  })
  couponId: number;

  @ManyToOne(() => CouponEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'coupon_id' })
  coupon: CouponEntity;

  @Column({
    name: 'combo_id',
    type: 'int',
    nullable: false,
  })
  comboId: number;
}
