import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import { DiscountsService } from '../services/discounts.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { DiscountResponseDto } from '../dto/response-discount.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('discounts')
export class DiscountsController {
  constructor(
    private readonly discountsService: DiscountsService,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  @Post()
  async create(
    @Body() dto: CreateDiscountDto,
  ): Promise<DiscountResponseDto> {
    return this.discountsService.create(dto);
  }

  // ==========================
  // GET ALL
  // ==========================

  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto): Promise<PaginatedResponseDto<DiscountResponseDto>> {
    return this.discountsService.findAll(page, limit);
  }

  // ==========================
  // GET ONE
  // ==========================

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DiscountResponseDto> {
    return this.discountsService.findOne(id);
  }

  // ==========================
  // UPDATE (parcial)
  // ==========================

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiscountDto,
  ): Promise<DiscountResponseDto> {
    return this.discountsService.update(id, dto);
  }

  // ==========================
  // SOFT DELETE
  // ==========================

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.discountsService.remove(id);
  }
}