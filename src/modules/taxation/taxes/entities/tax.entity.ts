import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { TaxTypeEntity } from '../../tax-types/entities/tax-types.entity';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';

@Entity('taxes')
@Index(['taxTypeId'])
export class TaxEntity extends BaseEntity {
  @Column({ name: 'tax_type_id' })
  taxTypeId: number;

  @ManyToOne(() => TaxTypeEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tax_type_id' })
  taxType: TaxTypeEntity;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: false,
  })
  value: number;

  @Column({
    type: 'boolean',
    nullable: false,
  })
  isPercentage: boolean;

  @Column({
    type: 'enum',
    enum: CurrencyCode,
    nullable: true,
  })
  currency?: CurrencyCode;

  @Column({ type: 'boolean', default: false, name: 'is_global' })
  isGlobal: boolean;
}
