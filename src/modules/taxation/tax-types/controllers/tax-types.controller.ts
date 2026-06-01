import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { TaxTypesService } from '../services/tax-types.service';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { CreateTaxTypeDto } from '../dto/create-tax-type.dto';
import { UpdateTaxTypeDto } from '../dto/update-tax-type.dto';
import { TaxTypeResponseDto } from '../dto/tax-type-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';

@ApiTags('Tax Types')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'tax-types' })
export class TaxTypesController {
  constructor(private taxTypesService: TaxTypesService) {}

  @ApiOperation({ summary: 'List tax types (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of tax types' })
  @Get()
  getTaxTypes(@Query() { page, limit }: PaginationQueryDto) {
    return this.taxTypesService.findAll(page, limit);
  }

  @ApiOperation({ summary: 'Get a tax type by ID' })
  @ApiResponse({ status: 200, type: TaxTypeResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Get(':id')
  findTaxType(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TaxTypeResponseDto> {
    return this.taxTypesService.findById(id);
  }

  @ApiOperation({ summary: 'Create a tax type' })
  @ApiResponse({ status: 201, type: TaxTypeResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Duplicate code or validation error',
  })
  @Post()
  createTaxType(@Body() body: CreateTaxTypeDto): Promise<TaxTypeResponseDto> {
    return this.taxTypesService.create(body);
  }

  @ApiOperation({ summary: 'Update a tax type' })
  @ApiResponse({ status: 200, type: TaxTypeResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Patch(':id')
  updateTaxType(
    @Param('id', ParseIntPipe) id: number,
    @Body() changes: UpdateTaxTypeDto,
  ): Promise<TaxTypeResponseDto> {
    return this.taxTypesService.update(id, changes);
  }

  @ApiOperation({ summary: 'Delete a tax type' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTaxType(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.taxTypesService.delete(id);
  }
}
