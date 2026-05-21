import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { ComboPricingService } from '../services/combo-pricing.service';
import { CreateComboPricingDto } from '../dto/create-combo-pricing.dto';
import { UpdateComboPricingDto } from '../dto/update-combo-pricing.dto';
import { ComboPricingResponseDto } from '../dto/combo-pricing-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Combo Pricing')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('combo-pricing')
export class ComboPricingController {
  constructor(private readonly service: ComboPricingService) {}

  @Post()
  @ApiOperation({ summary: 'Crear pricing para un combo' })
  @ApiResponse({ status: 201, type: ComboPricingResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o combo ya tiene pricing',
  })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  async create(
    @Body() dto: CreateComboPricingDto,
  ): Promise<ComboPricingResponseDto> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pricings de combos paginados' })
  @ApiResponse({ status: 200, type: ComboPricingResponseDto, isArray: true })
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.service.findAll(page, limit);
  }

  @Get('combo/:comboId')
  @ApiOperation({ summary: 'Obtener pricing por comboId' })
  @ApiParam({ name: 'comboId', type: Number })
  @ApiResponse({ status: 200, type: ComboPricingResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Pricing no encontrado para ese combo',
  })
  async findByCombo(
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<ComboPricingResponseDto> {
    return this.service.findByCombo(comboId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pricing por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: ComboPricingResponseDto })
  @ApiResponse({ status: 404, description: 'Pricing no encontrado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ComboPricingResponseDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar pricing (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: ComboPricingResponseDto })
  @ApiResponse({ status: 404, description: 'Pricing o margen no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComboPricingDto,
  ): Promise<ComboPricingResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar pricing (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado correctamente' })
  @ApiResponse({ status: 404, description: 'Pricing no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
