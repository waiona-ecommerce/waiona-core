import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { CouponUsageService } from '../services/coupon-usage.service';
import { CouponUsageResponseDto } from '../dto/coupon-usage-response.dto';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { RolesGuard } from '../../../../common/guards/roles.guard';

// El alta (aplicar un cupón a una orden) vive en OrdersModule —
// ver OrderCouponController — porque es una acción sobre la orden, no
// un reporte de cupones. Este controller queda solo de lectura/admin.
@ApiTags('Coupon Usage')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'coupon-usage' })
export class CouponUsageController {
  constructor(private readonly couponUsageService: CouponUsageService) {}

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Listar todos los usos de cupones paginado' })
  @ApiResponse({ status: 200, type: CouponUsageResponseDto, isArray: true })
  findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<CouponUsageResponseDto>> {
    return this.couponUsageService.findAll(page, limit);
  }

  @Get('coupon/:couponId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Usos por cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiResponse({ status: 200, type: CouponUsageResponseDto, isArray: true })
  findByCoupon(
    @Param('couponId', ParseIntPipe) couponId: number,
  ): Promise<CouponUsageResponseDto[]> {
    return this.couponUsageService.findByCoupon(couponId);
  }

  @Get('user/:userId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Usos por usuario' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, type: CouponUsageResponseDto, isArray: true })
  findByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<CouponUsageResponseDto[]> {
    return this.couponUsageService.findByUser(userId);
  }
}
