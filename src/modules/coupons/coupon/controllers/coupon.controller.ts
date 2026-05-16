import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { CouponService } from '../services/coupon.service';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { CouponResponseDto } from '../dto/coupon-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('coupons')
export class CouponController {
  constructor(
    private readonly couponService: CouponService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateCouponDto,
  ): Promise<CouponResponseDto> {
    return this.couponService.create(dto);
  }

  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto): Promise<PaginatedResponseDto<CouponResponseDto>> {
    return this.couponService.findAll(page, limit);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CouponResponseDto> {
    return this.couponService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponDto,
  ): Promise<CouponResponseDto> {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.couponService.remove(id);
  }
}