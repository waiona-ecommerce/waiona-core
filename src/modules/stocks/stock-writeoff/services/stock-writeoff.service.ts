import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StockWriteOffEntity } from '../entities/stock-writeoff.entity';
import { UpdateStockWriteOffDto } from '../dto/update-stock-writeoff.dto';
import { StockWriteOffResponseDto } from '../dto/stock-writeoff-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class StockWriteOffService {
  constructor(
    @InjectRepository(StockWriteOffEntity)
    private readonly stockWriteOffRepository: Repository<StockWriteOffEntity>,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<StockWriteOffResponseDto>> {
    const [writeOffs, total] = await this.stockWriteOffRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      writeOffs.map((w) => new StockWriteOffResponseDto(w)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findById(id: number): Promise<StockWriteOffResponseDto> {
    const writeOff = await this.findEntity(id);
    return new StockWriteOffResponseDto(writeOff);
  }

  // ==========================
  // GET BY STOCK ITEM
  // ==========================

  async findByStockItemId(
    stockItemId: number,
  ): Promise<StockWriteOffResponseDto[]> {
    const writeOffs = await this.stockWriteOffRepository.find({
      where: { stockItemId },
      order: { createdAt: 'DESC' },
    });

    return writeOffs.map((w) => new StockWriteOffResponseDto(w));
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateStockWriteOffDto,
  ): Promise<StockWriteOffResponseDto> {
    const writeOff = await this.findEntity(id);

    writeOff.reason = dto.reason ?? writeOff.reason;
    writeOff.description = dto.description ?? writeOff.description;
    writeOff.attachments = dto.attachments ?? writeOff.attachments;

    const saved = await this.stockWriteOffRepository.save(writeOff);

    return new StockWriteOffResponseDto(saved);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findEntity(id: number): Promise<StockWriteOffEntity> {
    const writeOff = await this.stockWriteOffRepository.findOne({
      where: { id },
    });

    if (!writeOff) {
      throw new NotFoundException(`StockWriteOff with id ${id} not found`);
    }

    return writeOff;
  }
}
