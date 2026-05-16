import { Controller, Get, Post, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CouponUsageService } from '../services/coupon-usage.service';
import { CouponUsageResponseDto } from '../dto/coupon-usage-response.dto';
import { CreateCouponUsageDto } from '../dto/create-coupon-usage.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('coupon-usage')
export class CouponUsageController {

  constructor(private readonly couponUsageService: CouponUsageService) {}

  @Post()
  create(
    @Body() dto: CreateCouponUsageDto,
  ): Promise<CouponUsageResponseDto> {
    return this.couponUsageService.create(dto);
  }

  @Get()
  findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.couponUsageService.findAll(page, limit);
  }

  @Get('coupon/:couponId')
  findByCoupon(
    @Param('couponId', ParseIntPipe) couponId: number,
  ): Promise<CouponUsageResponseDto[]> {
    return this.couponUsageService.findByCoupon(couponId);
  }

  @Get('user/:userId')
  findByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<CouponUsageResponseDto[]> {
    return this.couponUsageService.findByUser(userId);
  }
}