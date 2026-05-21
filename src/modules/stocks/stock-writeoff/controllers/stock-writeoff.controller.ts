import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
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

import { StockWriteOffService } from '../services/stock-writeoff.service';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { UpdateStockWriteOffDto } from '../dto/update-stock-writeoff.dto';
import { StockWriteOffResponseDto } from '../dto/stock-writeoff-response.dto';

import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';

@ApiTags('Stock Write-Offs')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stock-write-offs')
export class StockWriteOffController {
  constructor(private readonly stockWriteOffService: StockWriteOffService) {}

  @ApiOperation({ summary: 'List all stock write-offs (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of write-offs' })
  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.stockWriteOffService.findAll(page, limit);
  }

  @ApiOperation({ summary: 'Get all write-offs for a stock item' })
  @ApiResponse({ status: 200, type: [StockWriteOffResponseDto] })
  @ApiParam({ name: 'stockItemId', type: Number })
  @Get('stock-item/:stockItemId')
  async findByStockItemId(
    @Param('stockItemId', ParseIntPipe) stockItemId: number,
  ): Promise<StockWriteOffResponseDto[]> {
    return this.stockWriteOffService.findByStockItemId(stockItemId);
  }

  @ApiOperation({ summary: 'Get a write-off by ID' })
  @ApiResponse({ status: 200, type: StockWriteOffResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', type: Number })
  @Get(':id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StockWriteOffResponseDto> {
    return this.stockWriteOffService.findById(id);
  }

  @ApiOperation({
    summary: 'Update write-off metadata (reason, description, attachments)',
  })
  @ApiResponse({ status: 200, type: StockWriteOffResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', type: Number })
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockWriteOffDto,
  ): Promise<StockWriteOffResponseDto> {
    return this.stockWriteOffService.update(id, dto);
  }
}
