import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';

import { StockMovementService } from '../services/stock-movement.service';
import { StockMovementResponseDto } from '../dto/stock-movement-respose.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';

@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stock-movements')
export class StockMovementController {

  constructor(
    private readonly stockMovementService: StockMovementService,
  ) {}

  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.stockMovementService.findAll(page, limit);
  }

  @Get('stock-item/:stockItemId') // 🔥 antes que :id para evitar conflicto de rutas
  async findByStockItemId(
    @Param('stockItemId', ParseIntPipe) stockItemId: number,
  ): Promise<StockMovementResponseDto[]> {
    return this.stockMovementService.findByStockItemId(stockItemId);
  }

  @Get(':id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StockMovementResponseDto> {
    return this.stockMovementService.findById(id);
  }
}