import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/entities/base.entity';
import { ComboEntity } from '../../combos/entities/combo.entity';

@Entity('combo_images')
@Index(['comboId'])
export class ComboImageEntity extends BaseEntity {
  @Column({ name: 'combo_id' })
  comboId: number;

  @ManyToOne(() => ComboEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'combo_id' })
  combo: ComboEntity;

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
