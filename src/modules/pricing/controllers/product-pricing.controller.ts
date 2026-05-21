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

import { ProductPricingService } from '../services/product-pricing.service';
import { CreateProductPricingDto } from '../dto/create-product-pricing.dto';
import { UpdateProductPricingDto } from '../dto/update-product-pricing.dto';
import { ProductPricingResponseDto } from '../dto/product-pricing-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Product Pricing')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('product-pricing')
export class ProductPricingController {
  constructor(private readonly service: ProductPricingService) {}

  @Post()
  @ApiOperation({ summary: 'Crear pricing para un producto' })
  @ApiResponse({ status: 201, type: ProductPricingResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o producto ya tiene pricing',
  })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  async create(
    @Body() dto: CreateProductPricingDto,
  ): Promise<ProductPricingResponseDto> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pricings de productos paginados' })
  @ApiResponse({ status: 200, type: ProductPricingResponseDto, isArray: true })
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.service.findAll(page, limit);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Obtener pricing por productId' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({ status: 200, type: ProductPricingResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Pricing no encontrado para ese producto',
  })
  async findByProduct(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<ProductPricingResponseDto> {
    return this.service.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pricing por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: ProductPricingResponseDto })
  @ApiResponse({ status: 404, description: 'Pricing no encontrado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductPricingResponseDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar pricing (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: ProductPricingResponseDto })
  @ApiResponse({ status: 404, description: 'Pricing o margen no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductPricingDto,
  ): Promise<ProductPricingResponseDto> {
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
