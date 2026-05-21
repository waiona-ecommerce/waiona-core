import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';

import { ComboEntity } from 'src/modules/products/combos/entities/combo.entity';
import { TaxEntity } from 'src/modules/taxation/taxes/entities/tax.entity';

@Entity('combo_taxes')
@Index(['comboId', 'taxId'], { unique: true })
export class ComboTaxEntity extends BaseEntity {
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
