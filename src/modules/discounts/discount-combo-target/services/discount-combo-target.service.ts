import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiscountComboTargetEntity } from '../entities/discount-combo-target.entity';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
import { CreateDiscountComboTargetDto } from '../dto/create-discount-combo-target.dto';
import { DiscountComboTargetResponseDto } from '../dto/discount-combo-target.dto';

@Injectable()
export class DiscountComboTargetService {

  constructor(
    @InjectRepository(DiscountComboTargetEntity)
    private readonly repo: Repository<DiscountComboTargetEntity>,
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    discountId: number,
    dto: CreateDiscountComboTargetDto,
  ): Promise<DiscountComboTargetResponseDto> {
    await this.findDiscount(discountId);
    await this.validateUniqueTarget(discountId, dto.comboId);

    // 🔥 el combo no puede tener otro descuento activo (de cualquier descuento)
    await this.validateComboHasNoActiveDiscount(dto.comboId);

    const entity = this.repo.create({
      discountId,
      comboId: dto.comboId,
    });

    const saved = await this.repo.save(entity);

    return new DiscountComboTargetResponseDto(saved);
  }

  // ==========================
  // GET ALL BY DISCOUNT
  // ==========================

  async findAll(discountId: number): Promise<DiscountComboTargetResponseDto[]> {
    await this.findDiscount(discountId);

    const targets = await this.repo.find({
      where: { discountId },
    });

    return targets.map((t) => new DiscountComboTargetResponseDto(t));
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(discountId: number, comboId: number): Promise<void> {
    await this.findDiscount(discountId);

    const entity = await this.repo.findOne({
      where: { discountId, comboId },
    });

    if (!entity) {
      throw new NotFoundException(
        `Combo target ${comboId} not found for discount ${discountId}`,
      );
    }

    await this.repo.softDelete(entity.id);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findDiscount(discountId: number): Promise<DiscountEntity> {
    const discount = await this.discountRepository.findOne({
      where: { id: discountId },
    });

    if (!discount) {
      throw new NotFoundException(`Discount with id ${discountId} not found`);
    }

    return discount;
  }

  private async validateUniqueTarget(
    discountId: number,
    comboId: number,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { discountId, comboId },
    });

    if (existing) {
      throw new ConflictException(
        `Combo ${comboId} is already a target of discount ${discountId}`,
      );
    }
  }

  // 🔥 chequea que el combo no esté asociado a NINGÚN descuento activo
  private async validateComboHasNoActiveDiscount(comboId: number): Promise<void> {
    const existing = await this.repo.findOne({
      where: { comboId },
    });

    if (existing) {
      throw new ConflictException(
        `Combo ${comboId} already has an active discount assigned`,
      );
    }
  }
}