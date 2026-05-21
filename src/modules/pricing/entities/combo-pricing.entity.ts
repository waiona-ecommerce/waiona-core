import { BaseEntity } from 'src/common/entities/base.entity';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';
import { ComboEntity } from 'src/modules/products/combos/entities/combo.entity';
import { MarginEntity } from 'src/modules/margins/entities/margin.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('combo_pricing')
@Index(['comboId'], { unique: true })
export class ComboPricingEntity extends BaseEntity {
  @Column({
    name: 'combo_id',
    type: 'int',
  })
  comboId: number;

  @ManyToOne(() => ComboEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'combo_id' })
  combo: ComboEntity;

  @Column({
    type: 'enum',
    enum: CurrencyCode,
  })
  currency: CurrencyCode;

  // ==========================
  // BASE PRICE
  // ==========================

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  unitPrice: number;

  // ==========================
  // Margen
  // ==========================

  @ManyToOne(() => MarginEntity, { nullable: true })
  @JoinColumn({ name: 'margin_id' })
  margin?: MarginEntity | null;
}
