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

import { DiscountProductTargetService } from '../services/discount-product-target.service';
import { CreateDiscountProductTargetDto } from '../dto/create-discount-product-target.dto';
import { DiscountProductTargetResponseDto } from '../dto/discount-target-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Discounts — Product Targets')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('discounts/:discountId/targets/products')
export class DiscountProductTargetController {
  constructor(private readonly service: DiscountProductTargetService) {}

  // ==========================
  // CREATE
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Asignar producto a un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({ status: 201, type: DiscountProductTargetResponseDto })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El producto ya tiene un descuento asignado',
  })
  async create(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Body() dto: CreateDiscountProductTargetDto,
  ): Promise<DiscountProductTargetResponseDto> {
    return this.service.create(discountId, dto);
  }

  // ==========================
  // GET ALL BY DISCOUNT
  // ==========================

  @Get()
  @ApiOperation({ summary: 'Listar productos asignados a un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({
    status: 200,
    type: DiscountProductTargetResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  async findAll(
    @Param('discountId', ParseIntPipe) discountId: number,
  ): Promise<DiscountProductTargetResponseDto[]> {
    return this.service.findAll(discountId);
  }

  // ==========================
  // DELETE
  // ==========================

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar producto de un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async remove(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<void> {
    return this.service.remove(discountId, productId);
  }
}
