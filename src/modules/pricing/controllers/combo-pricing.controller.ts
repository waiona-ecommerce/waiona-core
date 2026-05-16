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

import { ComboPricingService } from '../services/combo-pricing.service';
import { CreateComboPricingDto } from '../dto/create-combo-pricing.dto';
import { UpdateComboPricingDto } from '../dto/update-combo-pricing.dto';
import { ComboPricingResponseDto } from '../dto/combo-pricing-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('combo-pricing')
export class ComboPricingController {

  constructor(private readonly service: ComboPricingService) {}

  @Post()
  async create(@Body() dto: CreateComboPricingDto): Promise<ComboPricingResponseDto> {
    return this.service.create(dto);
  }

  @Get()
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.service.findAll(page, limit);
  }

  // 🔥 antes de GET :id para evitar conflicto de rutas
  @Get('combo/:comboId')
  async findByCombo(
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<ComboPricingResponseDto> {
    return this.service.findByCombo(comboId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ComboPricingResponseDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComboPricingDto,
  ): Promise<ComboPricingResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}