import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

import { StockItemEntity } from '../../stock-item/entities/stock-item.entity';
import { StockMovementEntity } from '../../stock-movement/entities/stock-movement.entity';

import { StockWriteOffReason } from '../enums/stock-writeoff-reason.enum';

@Entity('stock_write_offs')
@Index(['stockItemId'])
@Index(['movementId'])
export class StockWriteOffEntity extends BaseEntity {
  @Column({
    name: 'stock_item_id',
    type: 'int',
    nullable: false,
  })
  stockItemId: number;

  @ManyToOne(() => StockItemEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItemEntity;

  @Column({
    name: 'movement_id',
    type: 'int',
    nullable: false,
  })
  movementId: number;

  @ManyToOne(() => StockMovementEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'movement_id' })
  movement: StockMovementEntity;

  @Column({
    type: 'int',
    nullable: false,
  })
  quantity: number;

  @Column({
    type: 'enum',
    enum: StockWriteOffReason,
    nullable: false,
  })
  reason: StockWriteOffReason;

  @Column({
    type: 'text',
    nullable: true, // 🔥 opcional
    default: null,
  })
  description?: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: null,
  })
  attachments?: string[] | null;

  @Column({
    name: 'reported_by',
    type: 'int',
    nullable: false,
  })
  reportedBy: number;
}
