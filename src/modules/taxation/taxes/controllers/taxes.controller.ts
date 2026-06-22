import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
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
} from '@nestjs/swagger';

import { TaxesService } from '../services/taxes.service';
import { CreateTaxDto } from '../dto/create-tax.dto';
import { UpdateTaxDto } from '../dto/update-tax.dto';
import { TaxResponseDto } from '../dto/tax-response.dto';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';

@ApiTags('Taxes')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'taxes' })
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @ApiOperation({ summary: 'List all taxes' })
  @ApiResponse({ status: 200, type: TaxResponseDto, isArray: true })
  @Get()
  findAll(
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<TaxResponseDto>> {
    return this.taxesService.findAll(page, limit);
  }

  @ApiOperation({ summary: 'Get a tax by ID' })
  @ApiResponse({ status: 200, type: TaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TaxResponseDto> {
    return this.taxesService.findById(id);
  }

  @ApiOperation({ summary: 'Create a tax' })
  @ApiResponse({ status: 201, type: TaxResponseDto })
  @Post()
  create(@Body() dto: CreateTaxDto): Promise<TaxResponseDto> {
    return this.taxesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a tax' })
  @ApiResponse({ status: 200, type: TaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxDto,
  ): Promise<TaxResponseDto> {
    return this.taxesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a tax' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.taxesService.delete(id);
  }
}
