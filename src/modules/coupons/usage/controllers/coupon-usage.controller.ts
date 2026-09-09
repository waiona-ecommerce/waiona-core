import {
  Controller,
  Get,
  Post,
  Body,
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
import { CreateCouponUsageDto } from '../dto/create-coupon-usage.dto';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../../common/decorators/current-user.decorator';
import { OrdersService } from '../../../orders/services/orders.service';
import { OrderResponseDto } from '../../../orders/dto/order-response.dto';

@ApiTags('Coupon Usage')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'coupon-usage' })
export class CouponUsageController {
  constructor(
    private readonly couponUsageService: CouponUsageService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  @Roles(RoleType.CLIENT)
  @ApiOperation({
    summary: 'Aplicar un cupón a una orden pendiente propia (solo cliente)',
  })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Cupón inactivo, expirado, agotado, no aplica a la orden, o la orden no está pendiente',
  })
  @ApiResponse({ status: 404, description: 'Cupón u orden no encontrados' })
  @ApiResponse({
    status: 409,
    description:
      'El usuario ya usó este cupón, la orden ya tiene un cupón aplicado, o la orden tiene un pago en curso',
  })
  create(
    @Body() dto: CreateCouponUsageDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponseDto> {
    return this.ordersService.applyCoupon(dto.orderId, dto.code, user.sub);
  }

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
