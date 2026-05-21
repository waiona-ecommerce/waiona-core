import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaxEntity } from '../entities/tax.entity';
import { TaxTypeEntity } from '../../tax-types/entities/tax-types.entity';

import { CreateTaxDto } from '../dto/create-tax.dto';
import { UpdateTaxDto } from '../dto/update-tax.dto';
import { TaxResponseDto } from '../dto/tax-response.dto';

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

  async findAll(taxTypeId: number): Promise<TaxResponseDto[]> {
    const entities = await this.taxRepository.find({
      where: { taxTypeId },
      relations: ['taxType'],
      order: { createdAt: 'DESC' },
    });

    return entities.map((entity) => new TaxResponseDto(entity));
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
      throw new BadRequestException(`TaxType with id ${taxTypeId} not found`);
    }

    if (!dto.isPercentage && !dto.currency) {
      throw new BadRequestException('Currency is required for fixed taxes');
    }

    if (dto.isPercentage && dto.currency) {
      throw new BadRequestException(
        'Percentage taxes should not have currency',
      );
    }

    const newEntity = this.taxRepository.create({
      taxTypeId,
      value: dto.value,
      isPercentage: dto.isPercentage,
      currency: dto.currency,
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

    const isPercentage = changes.isPercentage ?? entity.isPercentage;
    const currency =
      changes.currency !== undefined ? changes.currency : entity.currency;

    if (!isPercentage && !currency) {
      throw new BadRequestException('Currency is required for fixed taxes');
    }

    if (isPercentage && currency) {
      throw new BadRequestException(
        'Percentage taxes should not have currency',
      );
    }

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

    if (!entity) throw new NotFoundException(`Tax with id ${id} not found`);
    return entity;
  }
}
