import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/entities/base.entity';
import { ComboEntity } from './combo.entity';
import { ProductEntity } from '../../product/entities/product.entity';

@Entity('combo_items')
@Index(['comboId'])
@Index(['productId'])
export class ComboItemEntity extends BaseEntity {
  // ==========================
  // Foreign Keys
  // ==========================

  @Column({
    name: 'combo_id',
    type: 'int',
    nullable: false,
  })
  comboId: number;

  @Column({
    name: 'product_id',
    type: 'int',
    nullable: false,
  })
  productId: number;

  // ==========================
  // Relaciones
  // ==========================

  @ManyToOne(() => ComboEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'combo_id' })
  combo: ComboEntity;

  @ManyToOne(() => ProductEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  // ==========================
  // Cantidad del producto en el combo
  // ==========================

  @Column({
    type: 'int',
    nullable: false,
  })
  quantity: number;
}
