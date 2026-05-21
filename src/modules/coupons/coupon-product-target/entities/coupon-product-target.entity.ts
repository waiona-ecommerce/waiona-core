import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';

@Entity('coupon_product_targets')
@Index(['couponId'])
@Index(['productId'])
@Index(['couponId', 'productId'], { unique: true })
export class CouponProductTargetEntity extends BaseEntity {
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
    name: 'product_id',
    type: 'int',
    nullable: false,
  })
  productId: number;
}
