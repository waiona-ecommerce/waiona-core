import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  ParseIntPipe,
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

import { MarginsService } from '../services/margins.service';
import { CreateMarginDto } from '../dto/create-margin.dto';
import { UpdateMarginDto } from '../dto/update-margin.dto';
import { MarginResponseDto } from '../dto/response-margin.dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RoleType } from '../../../common/enums/role-type.enum';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

@ApiTags('Margins')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'margins' })
export class MarginsController {
  constructor(private readonly marginsService: MarginsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un margen de ganancia' })
  @ApiResponse({ status: 201, type: MarginResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un margen con ese nombre',
  })
  create(@Body() dto: CreateMarginDto): Promise<MarginResponseDto> {
    return this.marginsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar márgenes paginados' })
  @ApiResponse({ status: 200, type: MarginResponseDto, isArray: true })
  findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<MarginResponseDto>> {
    return this.marginsService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un margen por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: MarginResponseDto })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<MarginResponseDto> {
    return this.marginsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un margen (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: MarginResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un margen con ese nombre',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMarginDto,
  ): Promise<MarginResponseDto> {
    return this.marginsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un margen (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado correctamente' })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Margen en uso por uno o más pricings',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.marginsService.remove(id);
  }
}
