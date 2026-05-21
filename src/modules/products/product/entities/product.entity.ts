import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { BaseEntity } from '../../../../common/entities/base.entity';
import { ProductImageEntity } from '../../product-images/entities/product-image.entity';
import { ComboItemEntity } from '../../combos/entities/combo-item.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { ProductMeasurementUnit } from '../enums/product-measurement-unit.enum';

@Entity('products')
@Index(['name'])
@Index(['isActive'])
@Index(['sku'], { unique: true })
@Index(['categoryId'])
export class ProductEntity extends BaseEntity {
  // ==========================
  // Identificación
  // ==========================

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  sku: string;

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
    onDelete: 'RESTRICT', // no se puede borrar una categoría con productos
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  // ==========================
  // Unidad de medida
  // ==========================

  @Column({
    type: 'enum',
    enum: ProductMeasurementUnit,
    default: ProductMeasurementUnit.UNIT,
    nullable: false,
  })
  measurementUnit: ProductMeasurementUnit;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  measurementValue?: number;

  // ==========================
  // Relaciones
  // ==========================

  @OneToMany(() => ProductImageEntity, (image) => image.product)
  images: ProductImageEntity[];

  @OneToMany(() => ComboItemEntity, (item) => item.product)
  comboItems: ComboItemEntity[];
}
