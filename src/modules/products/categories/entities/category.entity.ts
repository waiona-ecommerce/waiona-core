import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('categories')
@Index(['name'])
@Index(['parentId'])
export class CategoryEntity extends BaseEntity {
  // ==========================
  // Datos básicos
  // ==========================

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ length: 255, nullable: true })
  description?: string;

  @Column({ default: true })
  isActive: boolean;

  // ==========================
  // Jerarquía
  // ==========================

  @Column({
    name: 'parent_id',
    type: 'int',
    nullable: true,
  })
  parentId?: number | null;

  @ManyToOne(() => CategoryEntity, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: CategoryEntity | null;

  @OneToMany(() => CategoryEntity, (category) => category.parent)
  children?: CategoryEntity[];
}
