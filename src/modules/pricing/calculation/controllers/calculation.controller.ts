import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { CalculationService } from '../services/calculation.service';
import { CalculatePreviewDto } from '../dto/calculate-preview.dto';
import { CalculateProductDto } from '../dto/calculate-product.dto';
import { CalculateComboDto } from '../dto/calculate-combo.dto';
import { PriceBreakdownDto } from '../dto/price-breakdown.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { RolesGuard } from '../../../../common/guards/roles.guard';

@ApiTags('Calculation')
@ApiBearerAuth()
@Controller({ version: '1', path: 'pricing/calculate' })
export class CalculationController {
  constructor(private readonly calculationService: CalculationService) {}

  // ==========================
  // PREVIEW — solo admin
  // ==========================

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('preview')
  @ApiOperation({ summary: 'Calcular precio con valores manuales (sin DB)' })
  @ApiResponse({ status: 200, type: PriceBreakdownDto })
  preview(@Body() dto: CalculatePreviewDto): PriceBreakdownDto {
    return this.calculationService.preview(dto);
  }

  // ==========================
  // PRODUCT — clientes autenticados (shop)
  // ==========================

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.CLIENT)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('product')
  @ApiOperation({ summary: 'Calcular precio de un producto' })
  @ApiResponse({ status: 200, type: PriceBreakdownDto })
  @ApiResponse({ status: 404, description: 'Producto sin pricing configurado' })
  calculateProduct(
    @Body() dto: CalculateProductDto,
  ): Promise<PriceBreakdownDto> {
    return this.calculationService.calculateProduct(dto);
  }

  // ==========================
  // COMBO — clientes autenticados (shop)
  // ==========================

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.CLIENT)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('combo')
  @ApiOperation({ summary: 'Calcular precio de un combo' })
  @ApiResponse({ status: 200, type: PriceBreakdownDto })
  @ApiResponse({
    status: 404,
    description: 'Combo o producto del combo sin pricing',
  })
  calculateCombo(@Body() dto: CalculateComboDto): Promise<PriceBreakdownDto> {
    return this.calculationService.calculateCombo(dto);
  }
}
