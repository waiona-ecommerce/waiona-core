import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiscountProductTargetEntity } from '../entities/discount-product-target.entity';
import { DiscountEntity } from '../../discount/entities/discounts.entity';
import { CreateDiscountProductTargetDto } from '../dto/create-discount-product-target.dto';
import { DiscountProductTargetResponseDto } from '../dto/discount-target-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class DiscountProductTargetService {
  constructor(
    @InjectRepository(DiscountProductTargetEntity)
    private readonly repo: Repository<DiscountProductTargetEntity>,
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    discountId: number,
    dto: CreateDiscountProductTargetDto,
  ): Promise<DiscountProductTargetResponseDto> {
    await this.findDiscount(discountId);
    await this.validateUniqueTarget(discountId, dto.productId);

    // 🔥 el producto no puede tener otro descuento activo (de cualquier descuento)
    await this.validateProductHasNoActiveDiscount(dto.productId);

    const entity = this.repo.create({
      discountId,
      productId: dto.productId,
    });

    const saved = await this.repo.save(entity);

    return new DiscountProductTargetResponseDto(saved);
  }

  // ==========================
  // GET ALL BY DISCOUNT
  // ==========================

  async findAll(
    discountId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<DiscountProductTargetResponseDto>> {
    await this.findDiscount(discountId);

    const [targets, total] = await this.repo.findAndCount({
      where: { discountId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      targets.map((t) => new DiscountProductTargetResponseDto(t)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(discountId: number, productId: number): Promise<void> {
    await this.findDiscount(discountId);

    const entity = await this.repo.findOne({
      where: { discountId, productId },
    });

    if (!entity) {
      throw new NotFoundException(
        `El producto ${productId} no está asignado al descuento ${discountId}`,
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
      throw new NotFoundException(
        `Descuento con id ${discountId} no encontrado`,
      );
    }

    return discount;
  }

  private async validateUniqueTarget(
    discountId: number,
    productId: number,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { discountId, productId },
    });

    if (existing) {
      throw new ConflictException(
        `El producto ${productId} ya es un target del descuento ${discountId}`,
      );
    }
  }

  private async validateProductHasNoActiveDiscount(
    productId: number,
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { productId } });

    if (existing) {
      throw new ConflictException(
        `El producto ${productId} ya tiene un descuento asignado`,
      );
    }
  }
}
