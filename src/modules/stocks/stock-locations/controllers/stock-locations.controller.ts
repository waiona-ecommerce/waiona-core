import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
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

import { StockLocationsService } from '../services/stock-locations.service';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { CreateStockLocationDto } from '../dto/create-stock-location.dto';
import { UpdateStockLocationDto } from '../dto/update-stock-location.dto';
import { StockLocationResponseDto } from '../dto/stock-location-response.dto';

import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';

@ApiTags('Stock Locations')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stock-locations')
export class StockLocationsController {
  constructor(private readonly stockLocationsService: StockLocationsService) {}

  @ApiOperation({ summary: 'Create a stock location (warehouse, store, etc.)' })
  @ApiResponse({ status: 201, type: StockLocationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Post()
  async create(
    @Body() dto: CreateStockLocationDto,
  ): Promise<StockLocationResponseDto> {
    return this.stockLocationsService.create(dto);
  }

  @ApiOperation({ summary: 'List all stock locations (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock locations',
  })
  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.stockLocationsService.findAll(page, limit);
  }

  @ApiOperation({ summary: 'Get a stock location by ID' })
  @ApiResponse({ status: 200, type: StockLocationResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', type: Number })
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StockLocationResponseDto> {
    return this.stockLocationsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a stock location' })
  @ApiResponse({ status: 200, type: StockLocationResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', type: Number })
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockLocationDto,
  ): Promise<StockLocationResponseDto> {
    return this.stockLocationsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a stock location' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', type: Number })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.stockLocationsService.remove(id);
  }
}
