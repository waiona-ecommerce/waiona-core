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

import { CouponComboTargetService } from '../services/coupon-combo-target.service';
import { CreateCouponComboTargetDto } from '../dto/create-coupon-combo-target.dto';
import { CouponComboTargetResponseDto } from '../dto/coupon-combo-target-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { RolesGuard } from '../../../../common/guards/roles.guard';

@ApiTags('Coupons — Combo Targets')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'coupons/:couponId/targets/combos' })
export class CouponComboTargetController {
  constructor(
    private readonly couponComboTargetService: CouponComboTargetService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Asignar combo a un cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiResponse({ status: 201, type: CouponComboTargetResponseDto })
  @ApiResponse({ status: 404, description: 'Cupón o combo no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El combo ya está asignado o el cupón es global',
  })
  async create(
    @Param('couponId', ParseIntPipe) couponId: number,
    @Body() dto: CreateCouponComboTargetDto,
  ): Promise<CouponComboTargetResponseDto> {
    return this.couponComboTargetService.create(couponId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar combos asignados a un cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiResponse({
    status: 200,
    type: CouponComboTargetResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  async findAll(
    @Param('couponId', ParseIntPipe) couponId: number,
  ): Promise<CouponComboTargetResponseDto[]> {
    return this.couponComboTargetService.findAll(couponId);
  }

  @Delete(':comboId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar combo de un cupón' })
  @ApiParam({ name: 'couponId', type: Number })
  @ApiParam({ name: 'comboId', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async remove(
    @Param('couponId', ParseIntPipe) couponId: number,
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<void> {
    return this.couponComboTargetService.remove(couponId, comboId);
  }
}
