import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
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

import { CategoryService } from '../services/category.service';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryResponseDto } from '../dto/category-response.dto';
import { CategoryTreeResponseDto } from '../dto/category-tree-response.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';

@ApiTags('Categories')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'categories' })
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ==========================
  // GET ALL (plano)
  // ==========================

  @Get()
  @ApiOperation({ summary: 'Listar categorías paginadas' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de categorías',
    type: CategoryResponseDto,
    isArray: true,
  })
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.categoryService.findAll(page, limit);
  }

  // ==========================
  // GET TREE
  // ==========================

  @Get('tree')
  @ApiOperation({ summary: 'Obtener árbol de categorías (jerarquía completa)' })
  @ApiResponse({
    status: 200,
    description: 'Árbol de categorías',
    type: CategoryTreeResponseDto,
    isArray: true,
  })
  async getTree(): Promise<CategoryTreeResponseDto[]> {
    return this.categoryService.getTree();
  }

  // ==========================
  // GET BY ID
  // ==========================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Categoría encontrada',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.findById(id);
  }

  // ==========================
  // CREATE
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Crear categoría' })
  @ApiResponse({
    status: 201,
    description: 'Categoría creada',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o categoría padre no encontrada',
  })
  async create(@Body() body: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoryService.create(body);
  }

  // ==========================
  // UPDATE
  // ==========================

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar categoría (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Categoría actualizada',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o jerarquía circular detectada',
  })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(id, body);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar categoría (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Categoría eliminada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Categoría tiene productos o combos activos asignados',
  })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoryService.delete(id);
  }
}
