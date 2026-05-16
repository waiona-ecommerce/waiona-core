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

  import { StockWriteOffService } from '../services/stock-writeoff.service';
  import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
  import { UpdateStockWriteOffDto } from '../dto/update-stock-writeoff.dto';
  import { StockWriteOffResponseDto } from '../dto/stock-writeoff-response.dto';
  
  import { AuthGuard } from '@nestjs/passport';
  import { RolesGuard } from 'src/common/guards/roles.guard';
  import { Roles } from 'src/common/decorators/roles.decorator';
  import { RoleType } from 'src/common/enums/role-type.enum';
  
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Controller('stock-write-offs')
  export class StockWriteOffController {
  
    constructor(
      private readonly stockWriteOffService: StockWriteOffService,
    ) {}
  
    // ==========================
    // GET ALL
    // ==========================
  
    @Get()
    async findAll(@Query() { page, limit }: PaginationQueryDto) {
      return this.stockWriteOffService.findAll(page, limit);
    }
  
    // ==========================
    // GET BY STOCK ITEM
    // ==========================
  
    @Get('stock-item/:stockItemId') // 🔥 antes que :id
    async findByStockItemId(
      @Param('stockItemId', ParseIntPipe) stockItemId: number,
    ): Promise<StockWriteOffResponseDto[]> {
      return this.stockWriteOffService.findByStockItemId(stockItemId);
    }
  
    // ==========================
    // GET BY ID
    // ==========================
  
    @Get(':id')
    async findById(
      @Param('id', ParseIntPipe) id: number,
    ): Promise<StockWriteOffResponseDto> {
      return this.stockWriteOffService.findById(id);
    }
  
    // ==========================
    // UPDATE
    // ==========================
  
    @Patch(':id')
    async update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdateStockWriteOffDto,
    ): Promise<StockWriteOffResponseDto> {
      return this.stockWriteOffService.update(id, dto);
    }
  }