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

import { DiscountComboTargetService } from '../services/discount-combo-target.service';
import { CreateDiscountComboTargetDto } from '../dto/create-discount-combo-target.dto';
import { DiscountComboTargetResponseDto } from '../dto/discount-combo-target.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Discounts — Combo Targets')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('discounts/:discountId/targets/combos')
export class DiscountComboTargetController {
  constructor(private readonly service: DiscountComboTargetService) {}

  @Post()
  @ApiOperation({ summary: 'Asignar combo a un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({ status: 201, type: DiscountComboTargetResponseDto })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El combo ya tiene un descuento asignado',
  })
  async create(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Body() dto: CreateDiscountComboTargetDto,
  ): Promise<DiscountComboTargetResponseDto> {
    return this.service.create(discountId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar combos asignados a un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({
    status: 200,
    type: DiscountComboTargetResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  async findAll(
    @Param('discountId', ParseIntPipe) discountId: number,
  ): Promise<DiscountComboTargetResponseDto[]> {
    return this.service.findAll(discountId);
  }

  @Delete(':comboId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar combo de un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiParam({ name: 'comboId', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async remove(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<void> {
    return this.service.remove(discountId, comboId);
  }
}
