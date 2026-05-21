import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';

import { ProductEntity } from 'src/modules/products/product/entities/product.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('product_taxes')
@Index(['productId', 'taxId'], { unique: true })
export class ProductTaxEntity extends BaseEntity {
  @Column({
    name: 'product_id',
    type: 'int',
  })
  productId: number;

  @ManyToOne(() => ProductEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({
    name: 'tax_id',
    type: 'int',
  })
  taxId: number;

  @ManyToOne(() => TaxEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tax_id' })
  tax: TaxEntity;
}
