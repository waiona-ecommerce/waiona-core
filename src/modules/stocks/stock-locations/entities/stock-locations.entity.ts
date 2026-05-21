import { Entity, Column, Index } from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { StockLocationType } from '../enums/stock-location-type.enum';

@Entity('stock_locations')
@Index(['name'])
export class StockLocationEntity extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 120,
    nullable: false,
  })
  name: string;

  @Column({
    type: 'enum',
    enum: StockLocationType,
    nullable: false,
  })
  type: StockLocationType;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null, // 🔥 explícito
  })
  address?: string | null;
}
