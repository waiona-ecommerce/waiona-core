import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiscountEntity } from '../entities/discounts.entity';
import { DiscountProductTargetEntity } from '../../discount-product-target/entities/discount-product-target.entity';
import { DiscountComboTargetEntity } from '../../discount-combo-target/entities/discount-combo-target.entity';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { DiscountResponseDto } from '../dto/response-discount.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,

    @InjectRepository(DiscountProductTargetEntity)
    private readonly productTargetRepo: Repository<DiscountProductTargetEntity>,

    @InjectRepository(DiscountComboTargetEntity)
    private readonly comboTargetRepo: Repository<DiscountComboTargetEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateDiscountDto): Promise<DiscountResponseDto> {
    this.validateDates(dto.startsAt, dto.endsAt);

    const discount = this.discountRepository.create({
      name: dto.name,
      description: dto.description,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      value: dto.value,
    });

    const saved = await this.discountRepository.save(discount);

    return new DiscountResponseDto(saved);
  }

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<DiscountResponseDto>> {
    const [discounts, total] = await this.discountRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      discounts.map((discount) => new DiscountResponseDto(discount)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET ONE
  // ==========================

  async findOne(id: number): Promise<DiscountResponseDto> {
    const discount = await this.findEntity(id);
    return new DiscountResponseDto(discount);
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateDiscountDto,
  ): Promise<DiscountResponseDto> {
    const discount = await this.findEntity(id);

    const startsAt = dto.startsAt ?? discount.startsAt;
    const endsAt = dto.endsAt ?? discount.endsAt;

    this.validateDates(startsAt, endsAt);

    discount.name = dto.name ?? discount.name;
    discount.description = dto.description ?? discount.description;
    discount.value = dto.value ?? discount.value;
    discount.startsAt = startsAt ?? null;
    discount.endsAt = endsAt ?? null;

    const updated = await this.discountRepository.save(discount);

    return new DiscountResponseDto(updated);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(id: number): Promise<void> {
    const discount = await this.findEntity(id);
    await this.discountRepository.softDelete(discount.id);
    await this.productTargetRepo.softDelete({ discountId: discount.id });
    await this.comboTargetRepo.softDelete({ discountId: discount.id });
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findEntity(id: number): Promise<DiscountEntity> {
    const discount = await this.discountRepository.findOne({
      where: { id },
    });

    if (!discount) {
      throw new NotFoundException(`Descuento con id ${id} no encontrado`);
    }

    return discount;
  }

  private validateDates(startsAt?: Date | null, endsAt?: Date | null): void {
    if (startsAt && endsAt) {
      if (new Date(startsAt) >= new Date(endsAt)) {
        throw new BadRequestException(
          'La fecha de inicio debe ser anterior a la fecha de fin',
        );
      }
    }
  }
}
