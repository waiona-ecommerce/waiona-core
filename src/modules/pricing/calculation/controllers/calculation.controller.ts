import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { CalculationService } from '../services/calculation.service';
import { CalculatePreviewDto } from '../dto/calculate-preview.dto';
import { CalculateProductDto } from '../dto/calculate-product.dto';
import { CalculateComboDto } from '../dto/calculate-combo.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('pricing/calculate')
export class CalculationController {
  constructor(private readonly calculationService: CalculationService) {}

  // ==========================
  // PREVIEW — solo admin
  // ==========================

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('preview')
  preview(@Body() dto: CalculatePreviewDto) {
    return this.calculationService.preview(dto);
  }

  // ==========================
  // PRODUCT — público (shop lo consume sin auth)
  // ==========================

  @Post('product')
  calculateProduct(@Body() dto: CalculateProductDto) {
    return this.calculationService.calculateProduct(dto);
  }

  // ==========================
  // COMBO — público (shop lo consume sin auth)
  // ==========================

  @Post('combo')
  calculateCombo(@Body() dto: CalculateComboDto) {
    return this.calculationService.calculateCombo(dto);
  }
}
