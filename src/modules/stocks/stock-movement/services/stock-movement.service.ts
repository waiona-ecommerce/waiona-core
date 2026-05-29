import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StockMovementEntity } from '../entities/stock-movement.entity';
import { StockMovementResponseDto } from '../dto/stock-movement-respose.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class StockMovementService {
  constructor(
    @InjectRepository(StockMovementEntity)
    private readonly stockMovementRepository: Repository<StockMovementEntity>,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<StockMovementResponseDto>> {
    const [movements, total] = await this.stockMovementRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      movements.map((m) => new StockMovementResponseDto(m)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findById(id: number): Promise<StockMovementResponseDto> {
    const movement = await this.stockMovementRepository.findOne({
      where: { id },
    });

    if (!movement) {
      throw new NotFoundException(
        `Movimiento de stock con id ${id} no encontrado`,
      );
    }

    return new StockMovementResponseDto(movement);
  }

  // ==========================
  // GET BY STOCK ITEM
  // ==========================

  async findByStockItemId(
    stockItemId: number,
  ): Promise<StockMovementResponseDto[]> {
    const movements = await this.stockMovementRepository.find({
      where: { stockItemId },
      order: { createdAt: 'DESC' },
    });

    return movements.map((movement) => new StockMovementResponseDto(movement));
  }
}
