import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

import { MarginEntity } from '../entities/margin.entity';
import { ProductPricingEntity } from '../../pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from '../../pricing/entities/combo-pricing.entity';
import { CreateMarginDto } from '../dto/create-margin.dto';
import { UpdateMarginDto } from '../dto/update-margin.dto';
import { MarginResponseDto } from '../dto/response-margin.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class MarginsService {
  constructor(
    @InjectRepository(MarginEntity)
    private readonly marginRepository: Repository<MarginEntity>,

    @InjectRepository(ProductPricingEntity)
    private readonly productPricingRepository: Repository<ProductPricingEntity>,

    @InjectRepository(ComboPricingEntity)
    private readonly comboPricingRepository: Repository<ComboPricingEntity>,
  ) {}

  // CREATE
  async create(dto: CreateMarginDto): Promise<MarginResponseDto> {
    await this.validateUniqueName(dto.name);

    const margin = this.marginRepository.create(dto);

    try {
      const saved = await this.marginRepository.save(margin);
      return new MarginResponseDto(saved);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe un margen con el nombre "${dto.name}"`,
        );
      }
      throw err;
    }
  }

  // GET ALL (no eliminados)
  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<MarginResponseDto>> {
    const [margins, total] = await this.marginRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      margins.map((margin) => new MarginResponseDto(margin)),
      total,
      page,
      limit,
    );
  }

  // GET BY ID
  async findOne(id: number): Promise<MarginResponseDto> {
    const margin = await this.findEntity(id);
    return new MarginResponseDto(margin);
  }

  // UPDATE (parcial, sin romper tipos)
  async update(id: number, dto: UpdateMarginDto): Promise<MarginResponseDto> {
    const margin = await this.findEntity(id);

    if (dto.name && dto.name !== margin.name) {
      await this.validateUniqueName(dto.name);
    }

    const merged = this.marginRepository.merge(margin, dto);

    try {
      const updated = await this.marginRepository.save(merged);
      return new MarginResponseDto(updated);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe un margen con el nombre "${dto.name}"`,
        );
      }
      throw err;
    }
  }

  // SOFT DELETE
  async remove(id: number): Promise<void> {
    const margin = await this.findEntity(id);

    const [productUsage, comboUsage] = await Promise.all([
      this.productPricingRepository.findOne({ where: { margin: { id } } }),
      this.comboPricingRepository.findOne({ where: { margin: { id } } }),
    ]);

    if (productUsage || comboUsage) {
      throw new ConflictException(
        'El margen está en uso por uno o más pricings y no puede eliminarse',
      );
    }

    await this.marginRepository.softDelete(margin.id);
  }

  // PRIVATE HELPERS

  private async findEntity(id: number): Promise<MarginEntity> {
    const margin = await this.marginRepository.findOne({ where: { id } });
    if (!margin)
      throw new NotFoundException(`Margen con id ${id} no encontrado`);
    return margin;
  }

  private async validateUniqueName(name: string): Promise<void> {
    const existing = await this.marginRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(
        `Ya existe un margen con el nombre "${name}"`,
      );
    }
  }
}
