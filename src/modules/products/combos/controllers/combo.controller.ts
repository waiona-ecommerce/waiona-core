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
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { ComboService } from '../services/combo.service';
import { CreateComboDto } from '../dto/create-combo.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { ComboResponseDto } from '../dto/combo-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@ApiTags('Combos')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('combos')
export class ComboController {
  constructor(private readonly comboService: ComboService) {}

  // ==========================
  // GET ALL
  // ==========================

  @Get()
  @ApiOperation({ summary: 'Listar combos paginados' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de combos',
    type: ComboResponseDto,
    isArray: true,
  })
  async findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ComboResponseDto>> {
    return this.comboService.findAll(page, limit);
  }

  // ==========================
  // GET BY ID
  // ==========================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener combo por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Combo encontrado',
    type: ComboResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Combo no encontrado' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ComboResponseDto> {
    return this.comboService.findById(id);
  }

  // ==========================
  // CREATE
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Crear combo con items' })
  @ApiResponse({
    status: 201,
    description: 'Combo creado',
    type: ComboResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, categoría o producto no encontrado',
  })
  async create(@Body() body: CreateComboDto): Promise<ComboResponseDto> {
    return this.comboService.create(body);
  }

  // ==========================
  // UPDATE
  // ==========================

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar combo (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Combo actualizado',
    type: ComboResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Combo no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateComboDto,
  ): Promise<ComboResponseDto> {
    return this.comboService.update(id, body);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar combo (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Combo eliminado' })
  @ApiResponse({ status: 404, description: 'Combo no encontrado' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.comboService.delete(id);
  }
}
