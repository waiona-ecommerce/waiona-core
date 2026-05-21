import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { DiscountsService } from '../services/discounts.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { DiscountResponseDto } from '../dto/response-discount.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@ApiTags('Discounts')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // ==========================
  // CREATE
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Crear un descuento' })
  @ApiResponse({ status: 201, type: DiscountResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(@Body() dto: CreateDiscountDto): Promise<DiscountResponseDto> {
    return this.discountsService.create(dto);
  }

  // ==========================
  // GET ALL
  // ==========================

  @Get()
  @ApiOperation({ summary: 'Listar descuentos paginados' })
  @ApiResponse({ status: 200, type: DiscountResponseDto, isArray: true })
  async findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<DiscountResponseDto>> {
    return this.discountsService.findAll(page, limit);
  }

  // ==========================
  // GET ONE
  // ==========================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener descuento por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: DiscountResponseDto })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DiscountResponseDto> {
    return this.discountsService.findOne(id);
  }

  // ==========================
  // UPDATE (parcial)
  // ==========================

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar descuento (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: DiscountResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiscountDto,
  ): Promise<DiscountResponseDto> {
    return this.discountsService.update(id, dto);
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar descuento (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.discountsService.remove(id);
  }
}
