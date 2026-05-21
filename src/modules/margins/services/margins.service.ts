import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MarginEntity } from '../entities/margin.entity';
import { ProductPricingEntity } from 'src/modules/pricing/entities/product-pricing.entity';
import { ComboPricingEntity } from 'src/modules/pricing/entities/combo-pricing.entity';
import { CreateMarginDto } from '../dto/create-margin.dto';
import { UpdateMarginDto } from '../dto/update-margin.dto';
import { MarginResponseDto } from '../dto/response-margin.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

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
    this.validatePercentageValue(dto.isPercentage, dto.value);

    const margin = this.marginRepository.create(dto);
    const saved = await this.marginRepository.save(margin);

    return new MarginResponseDto(saved);
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

    const isPercentage = dto.isPercentage ?? margin.isPercentage;
    const value = dto.value ?? Number(margin.value);
    this.validatePercentageValue(isPercentage, value);

    const merged = this.marginRepository.merge(margin, dto);
    const updated = await this.marginRepository.save(merged);

    return new MarginResponseDto(updated);
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
        'Margin is in use by one or more pricings and cannot be deleted',
      );
    }

    await this.marginRepository.softDelete(margin.id);
  }

  // PRIVATE HELPERS

  private async findEntity(id: number): Promise<MarginEntity> {
    const margin = await this.marginRepository.findOne({ where: { id } });
    if (!margin) throw new NotFoundException(`Margin with id ${id} not found`);
    return margin;
  }

  private async validateUniqueName(name: string): Promise<void> {
    const existing = await this.marginRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`Margin with name "${name}" already exists`);
    }
  }

  private validatePercentageValue(isPercentage: boolean, value: number): void {
    if (isPercentage && value > 100) {
      throw new BadRequestException('Percentage margin cannot exceed 100');
    }
  }
}
