import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    Delete,
    ParseIntPipe,
    UseGuards,
  } from '@nestjs/common';

  import { MarginsService } from '../services/margins.service';
  import { CreateMarginDto } from '../dto/create-margin.dto';
  import { UpdateMarginDto } from '../dto/update-margin.dto';
  import { MarginResponseDto } from '../dto/response-margin.dto';
  import { AuthGuard } from '@nestjs/passport';
  import { RolesGuard } from 'src/common/guards/roles.guard';
  import { Roles } from 'src/common/decorators/roles.decorator';
  import { RoleType } from 'src/common/enums/role-type.enum';
  import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
  import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
  
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Controller('margins')
  export class MarginsController {
    constructor(private readonly marginsService: MarginsService) {}
  
    // CREATE
    @Post()
    async create(
      @Body() dto: CreateMarginDto,
    ): Promise<MarginResponseDto> {
      return this.marginsService.create(dto);
    }
  
    // GET ALL
    @Get()
    async findAll(@Query() { page, limit }: PaginationQueryDto): Promise<PaginatedResponseDto<MarginResponseDto>> {
      return this.marginsService.findAll(page, limit);
    }
  
    // GET ONE
    @Get(':id')
    async findOne(
      @Param('id', ParseIntPipe) id: number,
    ): Promise<MarginResponseDto> {
      return this.marginsService.findOne(id);
    }
  
    // UPDATE (parcial)
    @Patch(':id')
    async update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdateMarginDto,
    ): Promise<MarginResponseDto> {
      return this.marginsService.update(id, dto);
    }
  
    // SOFT DELETE
    @Delete(':id')
    async remove(
      @Param('id', ParseIntPipe) id: number,
    ): Promise<void> {
      return this.marginsService.remove(id);
    }
  }