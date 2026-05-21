import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiscountEntity } from '../entities/discounts.entity';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { DiscountResponseDto } from '../dto/response-discount.dto';
import { CurrencyCode } from 'src/common/enums/currency-code.enum';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateDiscountDto): Promise<DiscountResponseDto> {
    this.validateDates(dto.startsAt, dto.endsAt);

    const normalized = this.normalizeDiscount({
      value: dto.value,
      isPercentage: dto.isPercentage,
      currency: dto.currency,
    });

    this.validateValue(
      normalized.value,
      normalized.isPercentage,
      normalized.currency,
    );

    const discount = this.discountRepository.create({
      name: dto.name,
      description: dto.description,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      value: normalized.value,
      isPercentage: normalized.isPercentage,
      currency: normalized.currency ?? null,
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

    // Reconstrucción explícita del estado final — sin spread de dto
    // para evitar pisar campos con undefined
    const value = Number(dto.value ?? discount.value); // 🔥 casteo siempre
    const isPercentage = dto.isPercentage ?? discount.isPercentage;
    const currency = dto.currency ?? discount.currency;

    const startsAt = dto.startsAt ?? discount.startsAt;
    const endsAt = dto.endsAt ?? discount.endsAt;

    this.validateDates(startsAt, endsAt);

    const normalized = this.normalizeDiscount({
      value,
      isPercentage,
      currency,
    });

    this.validateValue(
      normalized.value,
      normalized.isPercentage,
      normalized.currency,
    );

    // Asignación campo a campo — sin merge ni spread de dto
    discount.name = dto.name ?? discount.name;
    discount.description = dto.description ?? discount.description;
    discount.value = normalized.value;
    discount.isPercentage = normalized.isPercentage;
    discount.currency = normalized.currency ?? null;
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
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findEntity(id: number): Promise<DiscountEntity> {
    const discount = await this.discountRepository.findOne({
      where: { id },
    });

    if (!discount) {
      throw new NotFoundException(`Discount with id ${id} not found`);
    }

    return discount;
  }

  private validateDates(startsAt?: Date | null, endsAt?: Date | null): void {
    if (startsAt && endsAt) {
      if (new Date(startsAt) >= new Date(endsAt)) {
        // 🔥 >= en lugar de > para evitar startsAt === endsAt (rango vacío)
        throw new BadRequestException('startsAt must be before endsAt');
      }
    }
  }

  private validateValue(
    value: number,
    isPercentage: boolean,
    currency?: CurrencyCode | null,
  ): void {
    if (isPercentage) {
      if (value > 100) {
        throw new BadRequestException('Percentage discount cannot exceed 100');
      }
    } else {
      if (!currency) {
        throw new BadRequestException(
          'Fixed amount discount requires a currency',
        );
      }
    }
  }

  private normalizeDiscount({
    value,
    isPercentage,
    currency,
  }: {
    value: number;
    isPercentage: boolean;
    currency?: CurrencyCode | null;
  }) {
    return {
      value,
      isPercentage,
      // Si es porcentaje, currency siempre null — nunca queda dato huérfano
      currency: isPercentage ? null : currency,
    };
  }
}
