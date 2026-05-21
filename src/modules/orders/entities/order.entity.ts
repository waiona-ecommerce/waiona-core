import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { CouponEntity } from 'src/modules/coupons/coupon/entities/coupon.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { DeliveryType } from '../enums/delivery-type.enum';
import { OrderItemEntity } from './order-item.entity';

@Entity('orders')
@Index(['userId', 'status'])
export class OrderEntity extends BaseEntity {
  // ==========================
  // Relaciones
  // ==========================

  @Column({ name: 'user_id', type: 'int', nullable: false })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'coupon_id', type: 'int', nullable: true, default: null })
  couponId?: number | null;

  @ManyToOne(() => CouponEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coupon_id' })
  coupon?: CouponEntity | null;

  @OneToMany(() => OrderItemEntity, (item) => item.order, { cascade: true })
  items: OrderItemEntity[];

  // ==========================
  // Estado
  // ==========================

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // ==========================
  // Entrega
  // ==========================

  @Column({
    type: 'enum',
    enum: DeliveryType,
  })
  deliveryType: DeliveryType;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    default: null,
  })
  address?: string | null;

  // ==========================
  // Notas
  // ==========================

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    default: null,
  })
  notes?: string | null;

  // ==========================
  // Totales (snapshot)
  // ==========================

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  subtotal: number;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  couponDiscount?: number | null;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  total: number;
}
