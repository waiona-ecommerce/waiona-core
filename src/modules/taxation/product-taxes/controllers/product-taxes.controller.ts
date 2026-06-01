import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Patch,
  Delete,
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

import { ProductTaxesService } from '../services/product-taxes.service';
import { CreateProductTaxDto } from '../dto/create-product-tax.dto';
import { UpdateProductTaxDto } from '../dto/update-product-tax.dto';
import { ProductTaxResponseDto } from '../dto/product-tax-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';

@ApiTags('Product Taxes')
@ApiBearerAuth()
@ApiParam({ name: 'productId', type: Number })
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'products/:productId/taxes' })
export class ProductTaxesController {
  constructor(private readonly productTaxesService: ProductTaxesService) {}

  @ApiOperation({ summary: 'List taxes for a product' })
  @ApiResponse({ status: 200, type: [ProductTaxResponseDto] })
  @Get()
  findAll(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<ProductTaxResponseDto[]> {
    return this.productTaxesService.findAll(productId);
  }

  @ApiOperation({ summary: 'Get a product tax by ID' })
  @ApiResponse({ status: 200, type: ProductTaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductTaxResponseDto> {
    return this.productTaxesService.findOne(id);
  }

  @ApiOperation({ summary: 'Assign a tax to a product' })
  @ApiResponse({ status: 201, type: ProductTaxResponseDto })
  @ApiResponse({ status: 400, description: 'Tax not found or is global' })
  @Post()
  create(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: CreateProductTaxDto,
  ): Promise<ProductTaxResponseDto> {
    return this.productTaxesService.create({ ...dto, productId });
  }

  @ApiOperation({ summary: 'Update a product tax assignment' })
  @ApiResponse({ status: 200, type: ProductTaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductTaxDto,
  ): Promise<ProductTaxResponseDto> {
    return this.productTaxesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Remove a tax from a product' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productTaxesService.remove(id);
  }
}
