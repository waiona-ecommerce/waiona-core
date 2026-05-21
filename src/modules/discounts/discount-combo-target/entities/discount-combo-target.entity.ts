import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
import { ComboEntity } from '../../../products/combos/entities/combo.entity';

@Entity('discount_combo_targets')
@Index(['discountId'])
@Index(['comboId'])
export class DiscountComboTargetEntity extends BaseEntity {
  // ==========================
  // FK discount
  // ==========================

  @Column({
    name: 'discount_id',
    type: 'int',
    nullable: false,
  })
  discountId: number;

  @ManyToOne(() => DiscountEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'discount_id' })
  discount: DiscountEntity;

  // ==========================
  // FK combo
  // ==========================

  @Column({
    name: 'combo_id',
    type: 'int',
    nullable: false,
  })
  comboId: number;

  @ManyToOne(() => ComboEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'combo_id' })
  combo: ComboEntity;
}
