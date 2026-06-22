import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

@Entity('taxes')
@Index(['code'], { unique: true, where: '"deletedAt" IS NULL' })
export class TaxEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 20, nullable: false })
  code: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  name: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: false })
  value: number;

  @Column({ type: 'boolean', default: false, name: 'is_global' })
  isGlobal: boolean;
}
