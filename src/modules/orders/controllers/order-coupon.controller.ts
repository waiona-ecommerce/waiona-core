import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { OrdersService } from '../services/orders.service';
import { ApplyCouponDto } from '../dto/apply-coupon.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RoleType } from '../../../common/enums/role-type.enum';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';

// Vive en OrdersModule porque "aplicar un cupón" es una acción sobre una
// orden propia (recalcula su total), no un reporte de cupones — ver
// CouponUsageController (coupons) para las lecturas administrativas.
@ApiTags('Coupon Usage')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'coupon-usage' })
export class OrderCouponController {
  constructor(private readonly ordersService: OrdersService) {}

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
    @Body() dto: ApplyCouponDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponseDto> {
    return this.ordersService.applyCoupon(dto.orderId, dto.code, user.sub);
  }
}
