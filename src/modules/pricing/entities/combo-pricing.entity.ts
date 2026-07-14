import { BaseEntity } from '../../../common/entities/base.entity';
import { CurrencyCode } from '../../../common/enums/currency-code.enum';
import { ComboEntity } from '../../products/combos/entities/combo.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('combo_pricing')
@Index(['comboId'], { unique: true, where: '"deletedAt" IS NULL' })
export class ComboPricingEntity extends BaseEntity {
  @Column({ name: 'combo_id', type: 'int' })
  comboId: number;

  @ManyToOne(() => ComboEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'combo_id' })
  combo: ComboEntity;

  @Column({ type: 'enum', enum: CurrencyCode })
  currency: CurrencyCode;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ name: 'sale_price', type: 'decimal', precision: 12, scale: 2 })
  salePrice: number;
}
