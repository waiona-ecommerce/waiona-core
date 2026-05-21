import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';

import { BaseAuditEntity } from 'src/common/entities/base.audit.entity';
import { StockItemEntity } from '../../stock-item/entities/stock-item.entity';

import { StockOperationType } from '../enums/stock-operation-type.enum';
import { StockFlow } from '../enums/stock-flow.enum';
import { StockReferenceType } from '../enums/stock-reference.enum';

@Entity('stock_movements')
@Index(['stockItemId'])
@Index(['operationType'])
@Index(['stockFlow'])
@Index(['referenceType', 'referenceId']) // 🔥 índice compuesto para buscar por referencia
export class StockMovementEntity extends BaseAuditEntity {
  @Column({
    name: 'stock_item_id', // 🔥 snake_case
    type: 'int',
    nullable: false,
  })
  stockItemId: number;

  @ManyToOne(() => StockItemEntity, { nullable: false })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItemEntity;

  @Column({
    name: 'operation_type',
    type: 'enum',
    enum: StockOperationType,
    nullable: false,
  })
  operationType: StockOperationType;

  @Column({
    name: 'stock_flow',
    type: 'enum',
    enum: StockFlow,
    nullable: false,
  })
  stockFlow: StockFlow;

  @Column({
    type: 'int',
    nullable: false,
  })
  quantity: number;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: StockReferenceType,
    nullable: false,
  })
  referenceType: StockReferenceType;

  // 🔥 faltaba el ID de la referencia
  @Column({
    name: 'reference_id',
    type: 'int',
    nullable: true,
    default: null, // null si es MANUAL
  })
  referenceId?: number | null;
}
