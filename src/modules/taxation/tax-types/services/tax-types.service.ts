import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaxTypeEntity } from '../entities/tax-types.entity';
import { TaxEntity } from '../../taxes/entities/tax.entity';
import { CreateTaxTypeDto } from '../dto/create-tax-type.dto';
import { UpdateTaxTypeDto } from '../dto/update-tax-type.dto';
import { TaxTypeResponseDto } from '../dto/tax-type-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class TaxTypesService {
  constructor(
    @InjectRepository(TaxTypeEntity)
    private taxTypeRepository: Repository<TaxTypeEntity>,

    @InjectRepository(TaxEntity)
    private taxRepository: Repository<TaxEntity>,
  ) {}

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<TaxTypeResponseDto>> {
    const [entities, total] = await this.taxTypeRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      entities.map(TaxTypeResponseDto.fromEntity),
      total,
      page,
      limit,
    );
  }

  async findById(id: number): Promise<TaxTypeResponseDto> {
    const entity = await this.findEntity(id);
    return TaxTypeResponseDto.fromEntity(entity);
  }

  async create(dto: CreateTaxTypeDto): Promise<TaxTypeResponseDto> {
    await this.ensureCodeIsUnique(dto.code);

    const newEntity = this.taxTypeRepository.create(dto);
    const saved = await this.taxTypeRepository.save(newEntity);

    return TaxTypeResponseDto.fromEntity(saved);
  }

  async update(
    id: number,
    changes: UpdateTaxTypeDto,
  ): Promise<TaxTypeResponseDto> {
    const entity = await this.findEntity(id);

    if (changes.code && changes.code !== entity.code) {
      await this.ensureCodeIsUnique(changes.code);
    }

    const merged = this.taxTypeRepository.merge(entity, changes);
    const saved = await this.taxTypeRepository.save(merged);

    return TaxTypeResponseDto.fromEntity(saved);
  }

  async delete(id: number): Promise<void> {
    const entity = await this.findEntity(id);

    const usage = await this.taxRepository.findOne({
      where: { taxTypeId: entity.id },
    });

    if (usage) {
      throw new ConflictException(
        'El tipo de impuesto tiene impuestos asociados y no puede eliminarse',
      );
    }

    await this.taxTypeRepository.softDelete(entity.id);
  }

  private async findEntity(id: number): Promise<TaxTypeEntity> {
    const entity = await this.taxTypeRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(
        `Tipo de impuesto con id ${id} no encontrado`,
      );
    }

    return entity;
  }

  private async ensureCodeIsUnique(code: string): Promise<void> {
    const existing = await this.taxTypeRepository.findOne({
      where: { code },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un tipo de impuesto con el código "${code}"`,
      );
    }
  }
}
