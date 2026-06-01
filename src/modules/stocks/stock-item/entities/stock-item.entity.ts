import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

import { BaseEntity } from '../../../../common/entities/base.entity';
import { StockLocationEntity } from '../../stock-locations/entities/stock-locations.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';
import { StockMovementEntity } from '../../stock-movement/entities/stock-movement.entity';

@Entity('stock_items')
@Index(['productId', 'locationId'], { unique: true })
export class StockItemEntity extends BaseEntity {
  @Column({
    name: 'product_id', // 🔥 snake_case
    type: 'int',
    nullable: false,
  })
  productId: number;

  @ManyToOne(() => ProductEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({
    name: 'location_id', // 🔥 snake_case
    type: 'int',
    nullable: false,
  })
  locationId: number;

  @ManyToOne(() => StockLocationEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id' })
  location: StockLocationEntity;

  // =============================
  // STOCK
  // =============================

  @Column({
    name: 'quantity_current',
    type: 'int',
    nullable: false,
    default: 0,
  })
  quantityCurrent: number;

  @Column({
    name: 'quantity_reserved',
    type: 'int',
    nullable: false,
    default: 0,
  })
  quantityReserved: number;

  get quantityAvailable(): number {
    return this.quantityCurrent - this.quantityReserved;
  }

  // =============================
  // THRESHOLDS
  // =============================

  @Column({
    name: 'stock_min',
    type: 'int',
    nullable: false,
    default: 0,
  })
  stockMin: number;

  @Column({
    name: 'stock_critical',
    type: 'int',
    nullable: false,
    default: 0,
  })
  stockCritical: number;

  // =============================
  // RELATIONS
  // =============================

  @OneToMany(() => StockMovementEntity, (movement) => movement.stockItem)
  movements: StockMovementEntity[];
}
