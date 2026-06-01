import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { StockMovementService } from '../services/stock-movement.service';
import { StockMovementResponseDto } from '../dto/stock-movement-respose.dto';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';

@ApiTags('Stock Movements')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'stock-movements' })
export class StockMovementController {
  constructor(private readonly stockMovementService: StockMovementService) {}

  @ApiOperation({ summary: 'List all stock movements (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock movements',
  })
  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.stockMovementService.findAll(page, limit);
  }

  @ApiOperation({ summary: 'Get all movements for a stock item' })
  @ApiResponse({ status: 200, type: [StockMovementResponseDto] })
  @ApiParam({ name: 'stockItemId', type: Number })
  @Get('stock-item/:stockItemId')
  async findByStockItemId(
    @Param('stockItemId', ParseIntPipe) stockItemId: number,
  ): Promise<StockMovementResponseDto[]> {
    return this.stockMovementService.findByStockItemId(stockItemId);
  }

  @ApiOperation({ summary: 'Get a stock movement by ID' })
  @ApiResponse({ status: 200, type: StockMovementResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', type: Number })
  @Get(':id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StockMovementResponseDto> {
    return this.stockMovementService.findById(id);
  }
}
