import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StockLocationEntity } from '../entities/stock-locations.entity';
import { CreateStockLocationDto } from '../dto/create-stock-location.dto';
import { UpdateStockLocationDto } from '../dto/update-stock-location.dto';
import { StockLocationResponseDto } from '../dto/stock-location-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class StockLocationsService {
  constructor(
    @InjectRepository(StockLocationEntity)
    private readonly stockLocationRepository: Repository<StockLocationEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateStockLocationDto): Promise<StockLocationResponseDto> {
    const location = this.stockLocationRepository.create({
      name: dto.name,
      type: dto.type,
      address: dto.address ?? null,
    });

    const saved = await this.stockLocationRepository.save(location);

    return new StockLocationResponseDto(saved);
  }

  // ==========================
  // GET ALL
  // ==========================

  async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<StockLocationResponseDto>> {
    const [locations, total] = await this.stockLocationRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(locations.map((l) => new StockLocationResponseDto(l)), total, page, limit);
  }

  // ==========================
  // GET ONE
  // ==========================

  async findOne(id: number): Promise<StockLocationResponseDto> {
    const location = await this.findEntity(id);
    return new StockLocationResponseDto(location);
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateStockLocationDto,
  ): Promise<StockLocationResponseDto> {
    const location = await this.findEntity(id);

    // 🔥 asignación campo a campo — sin merge ni spread
    location.name = dto.name ?? location.name;
    location.type = dto.type ?? location.type;
    location.address = dto.address ?? location.address;

    const updated = await this.stockLocationRepository.save(location);

    return new StockLocationResponseDto(updated);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(id: number): Promise<void> {
    const location = await this.findEntity(id);
    await this.stockLocationRepository.softDelete(location.id);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findEntity(id: number): Promise<StockLocationEntity> {
    const location = await this.stockLocationRepository.findOne({
      where: { id },
    });

    if (!location) {
      throw new NotFoundException(`StockLocation with id ${id} not found`);
    }

    return location;
  }
}