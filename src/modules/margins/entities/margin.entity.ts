import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('margins')
@Index(['name'], { unique: true })
export class MarginEntity extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  name: string;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: false,
  })
  value: number;
}
