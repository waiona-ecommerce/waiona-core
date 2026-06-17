import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaxEntity } from '../entities/tax.entity';
import { TaxTypeEntity } from '../../tax-types/entities/tax-types.entity';

import { CreateTaxDto } from '../dto/create-tax.dto';
import { UpdateTaxDto } from '../dto/update-tax.dto';
import { TaxResponseDto } from '../dto/tax-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class TaxesService {
  constructor(
    @InjectRepository(TaxEntity)
    private taxRepository: Repository<TaxEntity>,

    @InjectRepository(TaxTypeEntity)
    private taxTypeRepository: Repository<TaxTypeEntity>,
  ) {}

  // ==========================
  // FIND ALL BY TAX TYPE
  // ==========================

  async findAll(
    taxTypeId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<TaxResponseDto>> {
    const taxType = await this.taxTypeRepository.findOne({
      where: { id: taxTypeId },
    });

    if (!taxType) {
      throw new NotFoundException(
        `Tipo de impuesto con id ${taxTypeId} no encontrado`,
      );
    }

    const [entities, total] = await this.taxRepository.findAndCount({
      where: { taxTypeId },
      relations: ['taxType'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      entities.map((entity) => new TaxResponseDto(entity)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // FIND BY ID
  // ==========================

  async findById(id: number): Promise<TaxResponseDto> {
    const entity = await this.findEntity(id);
    return new TaxResponseDto(entity);
  }

  // ==========================
  // CREATE
  // ==========================

  async create(taxTypeId: number, dto: CreateTaxDto): Promise<TaxResponseDto> {
    const taxType = await this.taxTypeRepository.findOne({
      where: { id: taxTypeId },
    });

    if (!taxType) {
      throw new NotFoundException(
        `Tipo de impuesto con id ${taxTypeId} no encontrado`,
      );
    }

    const newEntity = this.taxRepository.create({
      taxTypeId,
      value: dto.value,
      isGlobal: dto.isGlobal ?? false,
    });

    const saved = await this.taxRepository.save(newEntity);

    return new TaxResponseDto(await this.findEntity(saved.id));
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(id: number, changes: UpdateTaxDto): Promise<TaxResponseDto> {
    const entity = await this.findEntity(id);
    const merged = this.taxRepository.merge(entity, changes);
    const saved = await this.taxRepository.save(merged);

    return new TaxResponseDto(await this.findEntity(saved.id));
  }

  // ==========================
  // DELETE
  // ==========================

  async delete(id: number): Promise<void> {
    const entity = await this.findEntity(id);
    await this.taxRepository.softDelete(entity.id);
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findEntity(id: number): Promise<TaxEntity> {
    const entity = await this.taxRepository.findOne({
      where: { id },
      relations: ['taxType'],
    });

    if (!entity)
      throw new NotFoundException(`Impuesto con id ${id} no encontrado`);
    return entity;
  }
}
