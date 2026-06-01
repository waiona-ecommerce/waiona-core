import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StockLocationEntity } from '../entities/stock-locations.entity';
import { StockItemEntity } from '../../stock-item/entities/stock-item.entity';
import { CreateStockLocationDto } from '../dto/create-stock-location.dto';
import { UpdateStockLocationDto } from '../dto/update-stock-location.dto';
import { StockLocationResponseDto } from '../dto/stock-location-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class StockLocationsService {
  constructor(
    @InjectRepository(StockLocationEntity)
    private readonly stockLocationRepository: Repository<StockLocationEntity>,

    @InjectRepository(StockItemEntity)
    private readonly stockItemRepository: Repository<StockItemEntity>,
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

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<StockLocationResponseDto>> {
    const [locations, total] = await this.stockLocationRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      locations.map((l) => new StockLocationResponseDto(l)),
      total,
      page,
      limit,
    );
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

    location.name = dto.name ?? location.name;
    location.type = dto.type ?? location.type;
    if (dto.address !== undefined) {
      location.address = dto.address ?? null;
    }

    const updated = await this.stockLocationRepository.save(location);

    return new StockLocationResponseDto(updated);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(id: number): Promise<void> {
    const location = await this.findEntity(id);

    const stockItemCount = await this.stockItemRepository.count({
      where: { locationId: id },
    });

    if (stockItemCount > 0) {
      throw new ConflictException(
        `No se puede eliminar: la ubicación tiene ${stockItemCount} stock item(s) asignado(s)`,
      );
    }

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
      throw new NotFoundException(
        `Ubicación de stock con id ${id} no encontrada`,
      );
    }

    return location;
  }
}
