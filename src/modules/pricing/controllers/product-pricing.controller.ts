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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { ProductPricingService } from '../services/product-pricing.service';
import { CreateProductPricingDto } from '../dto/create-product-pricing.dto';
import { UpdateProductPricingDto } from '../dto/update-product-pricing-dto';
import { ProductPricingResponseDto } from '../dto/product-pricing-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('product-pricing')
export class ProductPricingController {

  constructor(private readonly service: ProductPricingService) {}

  @Post()
  async create(@Body() dto: CreateProductPricingDto): Promise<ProductPricingResponseDto> {
    return this.service.create(dto);
  }

  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.service.findAll(page, limit);
  }

  // 🔥 antes de GET :id para evitar conflicto de rutas
  @Get('product/:productId')
  async findByProduct(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<ProductPricingResponseDto> {
    return this.service.findByProduct(productId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductPricingResponseDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductPricingDto,
  ): Promise<ProductPricingResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}