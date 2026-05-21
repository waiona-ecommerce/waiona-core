import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

@Entity('tax_types')
export class TaxTypeEntity extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    unique: true,
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: false,
  })
  name: string;
}
