import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PG_UNIQUE_VIOLATION } from 'src/common/constants/postgres-error-codes';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ComboPricingEntity } from '../entities/combo-pricing.entity';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { MarginEntity } from 'src/modules/margins/entities/margin.entity';
import { CreateComboPricingDto } from '../dto/create-combo-pricing.dto';
import { UpdateComboPricingDto } from '../dto/update-combo-pricing.dto';
import { ComboPricingResponseDto } from '../dto/combo-pricing-response.dto';

@Injectable()
export class ComboPricingService {

  constructor(
    @InjectRepository(ComboPricingEntity)
    private repo: Repository<ComboPricingEntity>,

    @InjectRepository(MarginEntity)
    private marginRepo: Repository<MarginEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateComboPricingDto): Promise<ComboPricingResponseDto> {

    const existing = await this.repo.findOne({
      where: { comboId: dto.comboId },
    });

    if (existing) {
      throw new BadRequestException('Combo already has pricing');
    }

    const margin = dto.marginId
      ? await this.resolveMargin(dto.marginId)
      : null;

    const entity = this.repo.create({
      comboId: dto.comboId,
      currency: dto.currency,
      unitPrice: dto.unitPrice,
      margin,
    });

    try {
      const saved = await this.repo.save(entity);
      return new ComboPricingResponseDto(saved);
    } catch (err: any) {
      if (err.code === PG_UNIQUE_VIOLATION) throw new BadRequestException('Combo already has pricing');
      throw err;
    }
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, dto: UpdateComboPricingDto): Promise<ComboPricingResponseDto> {

    const entity = await this.findOneEntity(id);

    if (dto.marginId !== undefined) {
      entity.margin = dto.marginId
        ? await this.resolveMargin(dto.marginId)
        : null;
    }

    Object.assign(entity, {
      currency: dto.currency ?? entity.currency,
      unitPrice: dto.unitPrice ?? entity.unitPrice,
    });

    const saved = await this.repo.save(entity);
    return new ComboPricingResponseDto(saved);
  }

  // ==========================
  // FIND ALL
  // ==========================

  async findAll(page = 1, limit = 20): Promise<PaginatedResponseDto<ComboPricingResponseDto>> {
    const [entities, total] = await this.repo.findAndCount({
      relations: ['margin'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(entities.map((e) => new ComboPricingResponseDto(e)), total, page, limit);
  }

  // ==========================
  // FIND ONE
  // ==========================

  async findOne(id: number): Promise<ComboPricingResponseDto> {
    const entity = await this.findOneEntity(id);
    return new ComboPricingResponseDto(entity);
  }

  // ==========================
  // FIND BY COMBO
  // ==========================

  async findByCombo(comboId: number): Promise<ComboPricingResponseDto> {
    const entity = await this.repo.findOne({
      where: { comboId },
      relations: ['margin'],
    });

    if (!entity) {
      throw new NotFoundException('Combo pricing not found');
    }

    return new ComboPricingResponseDto(entity);
  }

  // ==========================
  // REMOVE
  // ==========================

  async remove(id: number): Promise<void> {
    const entity = await this.findOneEntity(id);
    await this.repo.softDelete(entity.id);
  }

  // ==========================
  // HELPERS
  // ==========================

  private async findOneEntity(id: number): Promise<ComboPricingEntity> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: ['margin'],
    });

    if (!entity) {
      throw new NotFoundException('Combo pricing not found');
    }

    return entity;
  }

  private async resolveMargin(marginId: number): Promise<MarginEntity> {
    const margin = await this.marginRepo.findOne({
      where: { id: marginId },
    });

    if (!margin) {
      throw new NotFoundException(`Margin with id ${marginId} not found`);
    }

    return margin;
  }
}