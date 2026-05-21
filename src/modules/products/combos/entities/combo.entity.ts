import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { BaseEntity } from '../../../../common/entities/base.entity';
import { ComboItemEntity } from './combo-item.entity';
import { ComboImageEntity } from '../../combo-images/entities/combo-image.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';

@Entity('combos')
@Index(['name'])
@Index(['isActive'])
@Index(['categoryId'])
export class ComboEntity extends BaseEntity {
  // ==========================
  // Información básica
  // ==========================

  @Column({
    type: 'varchar',
    length: 150,
    nullable: false,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  description: string;

  @Column({
    type: 'boolean',
    default: true,
    nullable: false,
  })
  isActive: boolean;

  // ==========================
  // Categoría
  // ==========================

  @Column({
    name: 'category_id',
    type: 'int',
    nullable: false,
  })
  categoryId: number;

  @ManyToOne(() => CategoryEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  // ==========================
  // Relaciones
  // ==========================

  @OneToMany(() => ComboItemEntity, (item) => item.combo)
  items: ComboItemEntity[];

  @OneToMany(() => ComboImageEntity, (image) => image.combo)
  images: ComboImageEntity[];
}
