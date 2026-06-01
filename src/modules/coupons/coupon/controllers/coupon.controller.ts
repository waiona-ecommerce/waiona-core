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

import { CouponService } from '../services/coupon.service';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { CouponResponseDto } from '../dto/coupon-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

@ApiTags('Coupons')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'coupons' })
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @ApiOperation({ summary: 'Crear cupón' })
  @ApiResponse({ status: 201, type: CouponResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o fechas incorrectas',
  })
  @ApiResponse({ status: 409, description: 'El código ya existe' })
  async create(@Body() dto: CreateCouponDto): Promise<CouponResponseDto> {
    return this.couponService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar cupones paginado' })
  @ApiResponse({ status: 200, type: CouponResponseDto, isArray: true })
  async findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<CouponResponseDto>> {
    return this.couponService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cupón por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: CouponResponseDto })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CouponResponseDto> {
    return this.couponService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cupón' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: CouponResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiResponse({ status: 409, description: 'El código ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponDto,
  ): Promise<CouponResponseDto> {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar cupón (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.couponService.remove(id);
  }
}
