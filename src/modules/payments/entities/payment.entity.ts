import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { OrderEntity } from 'src/modules/orders/entities/order.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

@Entity('payments')
@Index(['orderId'])
@Index(['externalId'])
export class PaymentEntity extends BaseEntity {
  // ==========================
  // Orden
  // ==========================

  @Column({ name: 'order_id', type: 'int', nullable: false })
  orderId: number;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  // ==========================
  // Proveedor
  // ==========================

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    nullable: false,
  })
  provider: PaymentProvider;

  // ==========================
  // Estado
  // ==========================

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    nullable: false,
  })
  status: PaymentStatus;

  // ==========================
  // Referencia externa
  // ==========================

  @Column({
    name: 'external_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  externalId?: string | null;

  @Column({
    name: 'checkout_url',
    type: 'varchar',
    length: 500,
    nullable: true,
    default: null,
  })
  checkoutUrl?: string | null;

  // ==========================
  // Monto
  // ==========================

  @Column('decimal', {
    precision: 12,
    scale: 2,
    nullable: false,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  amount: number;

  // ==========================
  // Metadata
  // ==========================

  @Column({
    type: 'jsonb',
    nullable: true,
    default: null,
  })
  metadata?: Record<string, any> | null;
}
