import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

import { TaxEntity } from '../entities/tax.entity';
import { ProductTaxEntity } from '../../product-taxes/entities/product-taxes.entity';
import { CreateTaxDto } from '../dto/create-tax.dto';
import { UpdateTaxDto } from '../dto/update-tax.dto';
import { TaxResponseDto } from '../dto/tax-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class TaxesService {
  constructor(
    @InjectRepository(TaxEntity)
    private taxRepository: Repository<TaxEntity>,

    @InjectRepository(ProductTaxEntity)
    private productTaxRepository: Repository<ProductTaxEntity>,
  ) {}

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<TaxResponseDto>> {
    const [entities, total] = await this.taxRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      entities.map((e) => new TaxResponseDto(e)),
      total,
      page,
      limit,
    );
  }

  async findById(id: number): Promise<TaxResponseDto> {
    return new TaxResponseDto(await this.findEntity(id));
  }

  async create(dto: CreateTaxDto): Promise<TaxResponseDto> {
    const existing = await this.taxRepository.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un impuesto con el código "${dto.code}"`,
      );
    }

    const entity = this.taxRepository.create({
      ...dto,
      isGlobal: dto.isGlobal ?? false,
    });
    try {
      const saved = await this.taxRepository.save(entity);
      return new TaxResponseDto(saved);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe un impuesto con el código "${dto.code}"`,
        );
      }
      throw err;
    }
  }

  async update(id: number, changes: UpdateTaxDto): Promise<TaxResponseDto> {
    const entity = await this.findEntity(id);

    if (changes.code && changes.code !== entity.code) {
      const existing = await this.taxRepository.findOne({
        where: { code: changes.code },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe un impuesto con el código "${changes.code}"`,
        );
      }
    }

    const merged = this.taxRepository.merge(entity, changes);
    try {
      const saved = await this.taxRepository.save(merged);
      return new TaxResponseDto(saved);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe un impuesto con el código "${changes.code}"`,
        );
      }
      throw err;
    }
  }

  async delete(id: number): Promise<void> {
    const entity = await this.findEntity(id);

    const usage = await this.productTaxRepository.findOne({
      where: { taxId: entity.id },
    });
    if (usage) {
      throw new ConflictException(
        'El impuesto está asignado a uno o más productos y no puede eliminarse',
      );
    }

    await this.taxRepository.softDelete(entity.id);
  }

  private async findEntity(id: number): Promise<TaxEntity> {
    const entity = await this.taxRepository.findOne({ where: { id } });
    if (!entity)
      throw new NotFoundException(`Impuesto con id ${id} no encontrado`);
    return entity;
  }
}
