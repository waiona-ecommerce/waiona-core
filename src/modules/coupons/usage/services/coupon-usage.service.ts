import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CouponUsageEntity } from '../entities/coupon-usage.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { UserEntity } from '../../../users/entities/user.entity';
import { CouponUsageResponseDto } from '../dto/coupon-usage-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

// La escritura de usos (crear/incrementar usageCount) vive en
// OrdersService.applyCoupon — necesita lockear la orden y sus ítems para
// validar elegibilidad y recalcular el total de forma atómica. Este service
// queda solo de lectura para no duplicar esa lógica en dos lugares.
@Injectable()
export class CouponUsageService {
  constructor(
    @InjectRepository(CouponUsageEntity)
    private readonly repo: Repository<CouponUsageEntity>,

    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  // ==========================
  // GET ALL
  // ==========================

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<CouponUsageResponseDto>> {
    const [usages, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(
      usages.map((u) => new CouponUsageResponseDto(u)),
      total,
      page,
      limit,
    );
  }

  // ==========================
  // GET BY COUPON
  // ==========================

  async findByCoupon(couponId: number): Promise<CouponUsageResponseDto[]> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });
    if (!coupon) {
      throw new NotFoundException(`Cupón con id ${couponId} no encontrado`);
    }

    const usages = await this.repo.find({
      where: { couponId },
      order: { createdAt: 'DESC' },
    });
    return usages.map((u) => new CouponUsageResponseDto(u));
  }

  // ==========================
  // GET BY USER
  // ==========================

  async findByUser(userId: number): Promise<CouponUsageResponseDto[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${userId} no encontrado`);
    }

    const usages = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return usages.map((u) => new CouponUsageResponseDto(u));
  }
}
