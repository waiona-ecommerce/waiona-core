import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CouponUsageEntity } from '../entities/coupon-usage.entity';
import { CouponEntity } from '../../coupon/entities/coupon.entity';
import { CouponUsageResponseDto } from '../dto/coupon-usage-response.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { CreateCouponUsageDto } from '../dto/create-coupon-usage.dto';

@Injectable()
export class CouponUsageService {
  constructor(
    @InjectRepository(CouponUsageEntity)
    private readonly repo: Repository<CouponUsageEntity>,

    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,

    private readonly dataSource: DataSource,
  ) {}

  // ==========================
  // CREATE (llamado desde órdenes al confirmar compra con cupón)
  // ==========================

  async create(dto: CreateCouponUsageDto): Promise<CouponUsageResponseDto> {
    const now = new Date();

    // Toda la validación y escritura ocurren dentro de la transacción con lock
    // sobre la fila del cupón para evitar race conditions en el límite de uso.
    const usage = await this.dataSource.transaction(async (manager) => {
      const coupon = await manager.findOne(CouponEntity, {
        where: { code: dto.code },
        lock: { mode: 'pessimistic_write' },
      });

      if (!coupon) {
        throw new NotFoundException(
          `Cupón con código "${dto.code}" no encontrado`,
        );
      }

      if (coupon.startsAt && now < coupon.startsAt) {
        throw new BadRequestException('El cupón aún no está activo');
      }
      if (coupon.endsAt && now > coupon.endsAt) {
        throw new BadRequestException('El cupón ha expirado');
      }
      if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
        if (coupon.usageCount >= coupon.usageLimit) {
          throw new BadRequestException(
            'El cupón ha alcanzado su límite de uso',
          );
        }
      }

      const alreadyUsed = await manager.findOne(CouponUsageEntity, {
        where: { couponId: coupon.id, userId: dto.userId },
      });
      if (alreadyUsed) {
        throw new ConflictException('El usuario ya utilizó este cupón');
      }

      const newUsage = manager.create(CouponUsageEntity, {
        couponId: coupon.id,
        orderId: dto.orderId,
        userId: dto.userId,
        appliedAt: now,
      });
      await manager.save(newUsage);

      coupon.usageCount += 1;
      await manager.save(coupon);

      return newUsage;
    });

    return new CouponUsageResponseDto(usage);
  }

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
    const usages = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return usages.map((u) => new CouponUsageResponseDto(u));
  }
}
