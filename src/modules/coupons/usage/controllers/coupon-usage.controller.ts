import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
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
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Coupon Usage')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('coupon-usage')
export class CouponUsageController {
  constructor(private readonly couponUsageService: CouponUsageService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar uso de cupón en una orden' })
  @ApiResponse({ status: 201, type: CouponUsageResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Cupón inactivo, expirado o agotado',
  })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiResponse({ status: 409, description: 'El usuario ya usó este cupón' })
  create(
    @Body() dto: CreateCouponUsageDto,
    @Req() req: any,
  ): Promise<CouponUsageResponseDto> {
    const { sub } = req.user as { sub: number; role: RoleType };
    return this.couponUsageService.create({ ...dto, userId: sub });
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los usos de cupones paginado' })
  @ApiResponse({ status: 200, type: CouponUsageResponseDto, isArray: true })
  findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<CouponUsageResponseDto>> {
    return this.couponUsageService.findAll(page, limit);
  }

  @Get('coupon/:couponId')
  @ApiOperation({ summary: 'Usos por cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiResponse({ status: 200, type: CouponUsageResponseDto, isArray: true })
  findByCoupon(
    @Param('couponId', ParseIntPipe) couponId: number,
  ): Promise<CouponUsageResponseDto[]> {
    return this.couponUsageService.findByCoupon(couponId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Usos por usuario' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, type: CouponUsageResponseDto, isArray: true })
  findByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<CouponUsageResponseDto[]> {
    return this.couponUsageService.findByUser(userId);
  }
}
