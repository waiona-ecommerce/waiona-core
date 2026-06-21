import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/entities/base.entity';
import { ProductEntity } from '../../product/entities/product.entity';

@Entity('product_images')
@Index(['productId'])
@Index(['productId', 'position'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class ProductImageEntity extends BaseEntity {
  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => ProductEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  url: string;

  @Column({
    name: 'public_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  publicId: string | null;

  @Column({
    type: 'int',
    nullable: false,
  })
  position: number;
}
