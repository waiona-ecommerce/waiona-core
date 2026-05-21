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

import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ==========================
  // GET ALL
  // ==========================

  @Get()
  @ApiOperation({ summary: 'Listar productos paginados' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de productos',
    type: ProductResponseDto,
    isArray: true,
  })
  async findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    return this.productService.findAll(page, limit);
  }

  // ==========================
  // GET BY ID
  // ==========================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Producto encontrado',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductResponseDto> {
    return this.productService.findById(id);
  }

  // ==========================
  // CREATE
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Crear producto' })
  @ApiResponse({
    status: 201,
    description: 'Producto creado',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o categoría no encontrada',
  })
  @ApiResponse({ status: 409, description: 'SKU ya existe' })
  async create(@Body() body: CreateProductDto): Promise<ProductResponseDto> {
    return this.productService.create(body);
  }

  // ==========================
  // UPDATE
  // ==========================

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar producto (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Producto actualizado',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productService.update(id, body);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar producto (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Producto eliminado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productService.delete(id);
  }
}
