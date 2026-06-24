import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  PG_UNIQUE_VIOLATION,
  PG_FK_VIOLATION,
} from '../../../common/constants/postgres-error-codes';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ComboPricingEntity } from '../entities/combo-pricing.entity';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { CreateComboPricingDto } from '../dto/create-combo-pricing.dto';
import { UpdateComboPricingDto } from '../dto/update-combo-pricing.dto';
import { ComboPricingResponseDto } from '../dto/combo-pricing-response.dto';

@Injectable()
export class ComboPricingService {
  constructor(
    @InjectRepository(ComboPricingEntity)
    private repo: Repository<ComboPricingEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateComboPricingDto): Promise<ComboPricingResponseDto> {
    if (dto.salePrice <= dto.unitPrice) {
      throw new BadRequestException(
        'El precio de venta debe ser mayor al precio de costo',
      );
    }

    const existing = await this.repo.findOne({
      where: { comboId: dto.comboId },
    });

    if (existing) {
      throw new ConflictException('El combo ya tiene un pricing asignado');
    }

    const entity = this.repo.create({
      comboId: dto.comboId,
      currency: dto.currency,
      unitPrice: dto.unitPrice,
      salePrice: dto.salePrice,
    });

    try {
      const saved = await this.repo.save(entity);
      return new ComboPricingResponseDto(saved);
    } catch (err: any) {
      if (err.code === PG_UNIQUE_VIOLATION)
        throw new ConflictException('El combo ya tiene un pricing asignado');
      if (err.code === PG_FK_VIOLATION)
        throw new NotFoundException(
          `Combo con id ${dto.comboId} no encontrado`,
        );
      throw err;
    }
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateComboPricingDto,
  ): Promise<ComboPricingResponseDto> {
    const entity = await this.findOneEntity(id);

    const effectiveUnitPrice = dto.unitPrice ?? Number(entity.unitPrice);
    const effectiveSalePrice = dto.salePrice ?? Number(entity.salePrice);

    if (effectiveSalePrice <= effectiveUnitPrice) {
      throw new BadRequestException(
        'El precio de venta debe ser mayor al precio de costo',
      );
    }

    Object.assign(entity, {
      currency: dto.currency ?? entity.currency,
      unitPrice: effectiveUnitPrice,
      salePrice: effectiveSalePrice,
    });

    const saved = await this.repo.save(entity);
    return new ComboPricingResponseDto(saved);
  }

  // ==========================
  // FIND ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<ComboPricingResponseDto>> {
    const [entities, total] = await this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      entities.map((e) => new ComboPricingResponseDto(e)),
      total,
      page,
      limit,
    );
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
    const entity = await this.repo.findOne({ where: { comboId } });

    if (!entity) {
      throw new NotFoundException('Pricing de combo no encontrado');
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
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException('Pricing de combo no encontrado');
    }

    return entity;
  }
}
