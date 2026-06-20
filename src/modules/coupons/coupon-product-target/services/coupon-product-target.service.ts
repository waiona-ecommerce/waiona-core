import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CouponProductTargetEntity } from '../entities/coupon-product-target.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { ProductEntity } from '../../../products/product/entities/product.entity';
import { CreateCouponProductTargetDto } from '../dto/create-coupon-product-target.dto';
import { CouponProductTargetResponseDto } from '../dto/coupon-product-target-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

@Injectable()
export class CouponProductTargetService {
  constructor(
    @InjectRepository(CouponProductTargetEntity)
    private readonly repo: Repository<CouponProductTargetEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(
    couponId: number,
    dto: CreateCouponProductTargetDto,
  ): Promise<CouponProductTargetResponseDto> {
    const coupon = await this.findCoupon(couponId);
    this.validateCouponNotGlobal(coupon);
    this.validateCouponUsable(coupon);
    await this.validateProductExists(dto.productId);
    await this.validateUniqueTarget(couponId, dto.productId);

    const entity = this.repo.create({
      couponId,
      productId: dto.productId,
    });

    const saved = await this.repo.save(entity);

    return new CouponProductTargetResponseDto(saved);
  }

  // ==========================
  // GET ALL BY COUPON
  // ==========================

  async findAll(
    couponId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<CouponProductTargetResponseDto>> {
    await this.findCoupon(couponId);

    const [targets, total] = await this.repo.findAndCount({
      where: { couponId },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      targets.map((t) => new CouponProductTargetResponseDto(t)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(couponId: number, productId: number): Promise<void> {
    await this.findCoupon(couponId);

    const entity = await this.repo.findOne({
      where: { couponId, productId },
    });

    if (!entity) {
      throw new NotFoundException(
        `El producto ${productId} no está asignado al cupón ${couponId}`,
      );
    }

    await this.repo.softDelete(entity.id);
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private async findCoupon(couponId: number): Promise<CouponEntity> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException(`Cupón con id ${couponId} no encontrado`);
    }

    return coupon;
  }

  private async validateProductExists(productId: number): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Producto con id ${productId} no encontrado`);
    }
  }

  private validateCouponNotGlobal(coupon: CouponEntity): void {
    if (coupon.isGlobal) {
      throw new ConflictException(
        'No se pueden asignar targets a un cupón global',
      );
    }
  }

  private validateCouponUsable(coupon: CouponEntity): void {
    const now = new Date();
    if (coupon.endsAt && now > coupon.endsAt) {
      throw new BadRequestException(
        'No se pueden asignar targets a un cupón expirado',
      );
    }
    if (
      coupon.usageLimit !== null &&
      coupon.usageLimit !== undefined &&
      coupon.usageCount >= coupon.usageLimit
    ) {
      throw new BadRequestException(
        'No se pueden asignar targets a un cupón agotado',
      );
    }
  }

  private async validateUniqueTarget(
    couponId: number,
    productId: number,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { couponId, productId },
    });

    if (existing) {
      throw new ConflictException(
        `El producto ${productId} ya es un target del cupón ${couponId}`,
      );
    }
  }
}
