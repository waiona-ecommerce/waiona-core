import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OrderEntity } from './order.entity';
import { ProductEntity } from '../../products/product/entities/product.entity';
import { ComboEntity } from '../../products/combos/entities/combo.entity';

@Entity('order_items')
export class OrderItemEntity extends BaseEntity {
  // ==========================
  // Orden
  // ==========================

  @Column({ name: 'order_id', type: 'int', nullable: false })
  orderId: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  // ==========================
  // Producto o Combo (uno de los dos)
  // ==========================

  @Column({ name: 'product_id', type: 'int', nullable: true, default: null })
  productId?: number | null;

  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity | null;

  @Column({ name: 'combo_id', type: 'int', nullable: true, default: null })
  comboId?: number | null;

  @ManyToOne(() => ComboEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'combo_id' })
  combo?: ComboEntity | null;

  // ==========================
  // Cantidad
  // ==========================

  @Column({ type: 'int', nullable: false })
  quantity: number;

  // ==========================
  // Ubicación de stock reservada (solo para items de producto)
  // Permite que dispatch/release usen la ubicación exacta sin re-query
  // ==========================

  @Column({ name: 'location_id', type: 'int', nullable: true, default: null })
  locationId?: number | null;

  // ==========================
  // Reservas de stock por componente (solo para combos)
  // Persiste { productId, locationId, quantity } de cada producto del combo
  // para que dispatch/release usen la ubicación exacta donde se reservó
  // ==========================

  @Column({
    name: 'combo_reservations',
    type: 'jsonb',
    nullable: true,
    default: null,
  })
  comboReservations?:
    | { productId: number; locationId: number; quantity: number }[]
    | null;

  // ==========================
  // Precio snapshot al momento de la compra
  // ==========================

  @Column('decimal', {
    name: 'unit_price',
    precision: 12,
    scale: 2,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  unitPrice: number;

  @Column('decimal', {
    name: 'sale_price',
    precision: 12,
    scale: 2,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  salePrice: number;

  @Column('decimal', {
    name: 'final_price',
    precision: 12,
    scale: 2,
    transformer: { to: (v) => v, from: (v) => Number(v) },
  })
  finalPrice: number;
}
