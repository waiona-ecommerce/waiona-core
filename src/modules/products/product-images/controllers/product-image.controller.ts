import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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

import { ProductImageService } from '../services/product-image.service';
import { CreateProductImageDto } from '../dto/create-product-image.dto';
import { UpdateProductImageDto } from '../dto/update-product-image.dto';
import { ProductImageResponseDto } from '../dto/product-image-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Product Images')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('product-images')
export class ProductImageController {
  constructor(private readonly productImageService: ProductImageService) {}

  // ==========================
  // CREATE
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Agregar imagen a un producto' })
  @ApiResponse({
    status: 201,
    description: 'Imagen creada',
    type: ProductImageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  create(@Body() dto: CreateProductImageDto): Promise<ProductImageResponseDto> {
    return this.productImageService.create(dto);
  }

  // ==========================
  // GET ALL BY PRODUCT
  // ==========================

  @Get('product/:productId')
  @ApiOperation({ summary: 'Listar imágenes de un producto' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imágenes del producto',
    type: ProductImageResponseDto,
    isArray: true,
  })
  findByProduct(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<ProductImageResponseDto[]> {
    return this.productImageService.findByProduct(productId);
  }

  // ==========================
  // GET BY ID
  // ==========================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener imagen por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imagen encontrada',
    type: ProductImageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductImageResponseDto> {
    return this.productImageService.findOne(id);
  }

  // ==========================
  // UPDATE
  // ==========================

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar imagen (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imagen actualizada',
    type: ProductImageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    return this.productImageService.update(id, dto);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar imagen (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Imagen eliminada' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productImageService.remove(id);
  }
}
