import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { UserEntity } from '../../../users/entities/user.entity';
import { OrderEntity } from '../../../orders/entities/order.entity';

@Entity('coupon_usages')
@Index(['couponId'])
@Index(['orderId'])
@Index(['userId'])
export class CouponUsageEntity extends BaseEntity {
  // ==========================
  // Cupón
  // ==========================

  @Column({ name: 'coupon_id', type: 'int', nullable: false })
  couponId: number;

  @ManyToOne(() => CouponEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: CouponEntity;

  // ==========================
  // Usuario
  // ==========================

  @Column({ name: 'user_id', type: 'int', nullable: false })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  // ==========================
  // Orden
  // ==========================

  @Column({ name: 'order_id', type: 'int', nullable: false })
  orderId: number;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  // ==========================
  // Metadata
  // ==========================

  @Column({
    name: 'applied_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  appliedAt: Date;
}
