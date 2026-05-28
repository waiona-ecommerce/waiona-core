import { Entity, Column, Index } from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('discounts')
@Index(['startsAt'])
@Index(['endsAt'])
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
    default: null, // 🔥 explícito para consistencia con DB
  })
  description?: string;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      // 🔥 TypeORM devuelve decimals como string — esto evita castear en cada lugar
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  value: number;

  @Column({
    name: 'starts_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  startsAt?: Date | null; // 🔥 idem

  @Column({
    name: 'ends_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  endsAt?: Date | null; // 🔥 idem
}
