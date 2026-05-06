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
import { AuthGuard } from '@nestjs/passport';

import { DiscountComboTargetService } from '../services/discount-combo-target.service';
import { CreateDiscountComboTargetDto } from '../dto/create-discount-combo-target.dto';
import { DiscountComboTargetResponseDto } from '../dto/discount-combo-target.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

// 🔥 guards agregados — antes este controller era público
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('discounts/:discountId/targets/combos')
export class DiscountComboTargetController {

  constructor(private readonly service: DiscountComboTargetService) {}

  @Post()
  async create(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Body() dto: CreateDiscountComboTargetDto,
  ): Promise<DiscountComboTargetResponseDto> {
    return this.service.create(discountId, dto);
  }

  @Get()
  async findAll(
    @Param('discountId', ParseIntPipe) discountId: number,
  ): Promise<DiscountComboTargetResponseDto[]> {
    return this.service.findAll(discountId);
  }

  @Delete(':comboId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<void> {
    return this.service.remove(discountId, comboId);
  }
}