import { BaseEntity } from '../../../common/entities/base.entity';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';
import { ProductEntity } from '../../products/product/entities/product.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('product_pricing')
@Index(['productId'], { unique: true, where: '"deletedAt" IS NULL' })
export class ProductPricingEntity extends BaseEntity {
  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ type: 'enum', enum: CurrencyCode })
  currency: CurrencyCode;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ name: 'sale_price', type: 'decimal', precision: 12, scale: 2 })
  salePrice: number;
}
