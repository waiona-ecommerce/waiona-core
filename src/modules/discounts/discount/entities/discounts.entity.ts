import { Entity, Column } from 'typeorm';

import { BaseEntity } from '../../../../common/entities/base.entity';

@Entity('discounts')
export class DiscountEntity extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    default: null,
  })
  description?: string;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  value: number;
}
