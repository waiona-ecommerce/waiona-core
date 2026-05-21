import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
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

import { CouponProductTargetService } from '../services/coupon-product-target.service';
import { CreateCouponProductTargetDto } from '../dto/create-coupon-product-target.dto';
import { CouponProductTargetResponseDto } from '../dto/coupon-product-target-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Coupons — Product Targets')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('coupons/:couponId/targets/products')
export class CouponProductTargetController {
  constructor(
    private readonly couponProductTargetService: CouponProductTargetService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Asignar producto a un cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiResponse({ status: 201, type: CouponProductTargetResponseDto })
  @ApiResponse({ status: 404, description: 'Cupón o producto no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El producto ya está asignado o el cupón es global',
  })
  async create(
    @Param('couponId', ParseIntPipe) couponId: number,
    @Body() dto: CreateCouponProductTargetDto,
  ): Promise<CouponProductTargetResponseDto> {
    return this.couponProductTargetService.create(couponId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos asignados a un cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiResponse({
    status: 200,
    type: CouponProductTargetResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  async findAll(
    @Param('couponId', ParseIntPipe) couponId: number,
  ): Promise<CouponProductTargetResponseDto[]> {
    return this.couponProductTargetService.findAll(couponId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar producto de un cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async remove(
    @Param('couponId', ParseIntPipe) couponId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<void> {
    return this.couponProductTargetService.remove(couponId, productId);
  }
}
