import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { StockItemsService } from '../services/stock-item.service';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

import { CreateStockItemDto } from '../dto/create-stock-item.dto';
import { UpdateStockThresholdsDto } from '../dto/update-stock-thresholds.dto';
import { StockItemAddStockDto } from '../dto/stock-item-add-stock.dto';

import { StockItemResponseDto } from '../dto/stock-item-response.dto';
import { StockItemWithMovementsResponseDto } from '../dto/stock-item-with-movements-response.dto';

import { CreateStockWriteOffDto } from '../../stock-writeoff/dto/create-stock-writeoff.dto';
import { StockDispatchDto } from '../dto/stock-item-dispatch.dto';
import { StockReleaseDto } from '../dto/stock-item-release.dto';

import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Stock Items')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'stock-items' })
export class StockItemsController {
  constructor(private readonly stockItemsService: StockItemsService) {}

  @ApiOperation({ summary: 'List all stock items (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of stock items' })
  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.stockItemsService.findAll(page, limit);
  }

  @ApiOperation({ summary: 'Get a stock item with its movement history' })
  @ApiResponse({ status: 200, type: StockItemWithMovementsResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', type: Number })
  @Get(':id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StockItemWithMovementsResponseDto> {
    return this.stockItemsService.findById(id);
  }

  @ApiOperation({ summary: 'Create a stock item for a product + location' })
  @ApiResponse({ status: 201, type: StockItemResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid thresholds' })
  @ApiResponse({
    status: 409,
    description: 'Stock item already exists for this product and location',
  })
  @Post()
  async create(@Body() dto: CreateStockItemDto): Promise<StockItemResponseDto> {
    return this.stockItemsService.create(dto);
  }

  @ApiOperation({ summary: 'Add stock to a product at a location' })
  @ApiResponse({ status: 201, type: StockItemWithMovementsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid quantity' })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  @Post('add-stock')
  async addStock(
    @Body() dto: StockItemAddStockDto,
  ): Promise<StockItemWithMovementsResponseDto> {
    return this.stockItemsService.addStock(
      dto.productId,
      dto.locationId,
      dto.quantity,
    );
  }

  @ApiOperation({ summary: 'Write off available stock (manual adjustment)' })
  @ApiResponse({ status: 201, type: StockItemWithMovementsResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid quantity or insufficient stock',
  })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  @Post('write-off')
  async writeOff(
    @Body() dto: CreateStockWriteOffDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<StockItemWithMovementsResponseDto> {
    return this.stockItemsService.writeOffDamage(dto, user.sub);
  }

  @ApiOperation({
    summary: 'Write off damaged stock and create a write-off record',
  })
  @ApiResponse({ status: 201, type: StockItemWithMovementsResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid quantity or insufficient stock',
  })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  @Post('write-off-damage')
  async writeOffDamage(
    @Body() dto: CreateStockWriteOffDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<StockItemWithMovementsResponseDto> {
    return this.stockItemsService.writeOffDamage(dto, user.sub);
  }

  @ApiOperation({ summary: 'Dispatch reserved stock for an order' })
  @ApiResponse({ status: 201, description: 'Stock dispatched' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient reserved or current stock',
  })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  @Post('dispatch')
  async dispatchStock(@Body() dto: StockDispatchDto): Promise<void> {
    return this.stockItemsService.dispatchStock(
      dto.productId,
      dto.locationId,
      dto.quantity,
      dto.orderId,
    );
  }

  @ApiOperation({
    summary: 'Release a stock reservation for a cancelled order',
  })
  @ApiResponse({ status: 201, description: 'Reservation released' })
  @ApiResponse({ status: 400, description: 'Insufficient reserved stock' })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  @Post('release')
  async releaseReservation(@Body() dto: StockReleaseDto): Promise<void> {
    return this.stockItemsService.releaseReservation(
      dto.productId,
      dto.locationId,
      dto.quantity,
      dto.orderId,
    );
  }

  @ApiOperation({ summary: 'Update stock alert thresholds' })
  @ApiResponse({ status: 200, type: StockItemResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid threshold values' })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  @ApiParam({ name: 'id', type: Number })
  @Patch(':id/thresholds')
  async updateThresholds(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockThresholdsDto,
  ): Promise<StockItemResponseDto> {
    return this.stockItemsService.updateThresholds(id, dto);
  }
}
