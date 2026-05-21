import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementEntity } from '../entities/stock-movement.entity';
import { StockOperationType } from '../enums/stock-operation-type.enum';
import { StockFlow } from '../enums/stock-flow.enum';
import { StockReferenceType } from '../enums/stock-reference.enum';

export class StockMovementResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  stockItemId: number;

  @ApiProperty({ enum: StockOperationType })
  operationType: StockOperationType;

  @ApiProperty({ enum: StockFlow })
  stockFlow: StockFlow;

  @ApiProperty({ example: 10 })
  quantity: number;

  @ApiProperty({ enum: StockReferenceType })
  referenceType: StockReferenceType;

  @ApiPropertyOptional({
    example: 42,
    description: 'ID de la orden o referencia; null si es MANUAL',
  })
  referenceId?: number;

  @ApiProperty()
  createdAt: Date;

  constructor(entity: StockMovementEntity) {
    this.id = entity.id;
    this.stockItemId = entity.stockItemId;
    this.operationType = entity.operationType;
    this.stockFlow = entity.stockFlow;
    this.quantity = entity.quantity;
    this.referenceType = entity.referenceType;
    this.referenceId = entity.referenceId ?? undefined;
    this.createdAt = entity.createdAt;
  }
}
