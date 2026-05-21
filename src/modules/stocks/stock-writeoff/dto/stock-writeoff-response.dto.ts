import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockWriteOffEntity } from '../entities/stock-writeoff.entity';
import { StockWriteOffReason } from '../enums/stock-writeoff-reason.enum';

export class StockWriteOffResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  stockItemId: number;

  @ApiProperty({ example: 10 })
  movementId: number;

  @ApiProperty({ example: 3 })
  quantity: number;

  @ApiProperty({ enum: StockWriteOffReason })
  reason: StockWriteOffReason;

  @ApiPropertyOptional({ example: 'Cajas rotas en tránsito' })
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  attachments?: string[];

  @ApiProperty({ example: 99 })
  reportedBy: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: StockWriteOffEntity) {
    this.id = entity.id;
    this.stockItemId = entity.stockItemId;
    this.movementId = entity.movementId;
    this.quantity = entity.quantity;
    this.reason = entity.reason;
    this.description = entity.description ?? undefined;
    this.attachments = entity.attachments ?? undefined;
    this.reportedBy = entity.reportedBy;

    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
