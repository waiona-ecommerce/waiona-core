import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { ShopService } from '../services/shop.service';
import { SearchShopDto } from '../dto/search-shop.dto';
import { ShopPaginatedResponseDto } from '../dto/shop-paginated-response.dto';
import { ShopDetailResponseDto } from '../dto/shop-detail-response.dto';
import { CategoryTreeResponseDto } from '../../categories/dto/category-tree-response.dto';

@ApiTags('Shop')
@Controller({ version: '1', path: 'shop' })
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  // ==========================
  // GET /shop/categories
  // ==========================

  @Get('categories')
  @ApiOperation({ summary: 'Árbol de categorías activas del catálogo' })
  @ApiResponse({ status: 200, type: [CategoryTreeResponseDto] })
  async getCategories(): Promise<CategoryTreeResponseDto[]> {
    return this.shopService.getCategories();
  }

  // ==========================
  // GET /shop/items
  // ==========================

  @Get('items')
  @ApiOperation({ summary: 'Buscar productos y combos del catálogo público' })
  @ApiResponse({
    status: 200,
    description: 'Resultados paginados del catálogo',
    type: ShopPaginatedResponseDto,
  })
  async search(
    @Query() query: SearchShopDto,
  ): Promise<ShopPaginatedResponseDto> {
    return this.shopService.search(query);
  }

  // ==========================
  // GET /shop/items/:id
  // ==========================

  @Get('items/:id')
  @ApiOperation({ summary: 'Obtener detalle de un producto o combo' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'type', enum: ['product', 'combo'], required: true })
  @ApiResponse({
    status: 200,
    description: 'Detalle del ítem con precio y stock',
    type: ShopDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetro type requerido (product | combo)',
  })
  @ApiResponse({
    status: 404,
    description: 'Ítem no encontrado o sin precio configurado',
  })
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @Query('type') type: 'product' | 'combo',
  ): Promise<ShopDetailResponseDto> {
    return this.shopService.findById(id, type);
  }
}
