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

import { TaxTypesService } from '../services/tax-types.service';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { CreateTaxTypeDto } from '../dto/create-tax-type.dto';
import { UpdateTaxTypeDto } from '../dto/update-tax-type.dto';
import { TaxTypeResponseDto } from '../dto/tax-type-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tax-types')
export class TaxTypesController {
  constructor(private taxTypesService: TaxTypesService) {}

  @Get()
  getTaxTypes(@Query() { page, limit }: PaginationQueryDto) {
    return this.taxTypesService.findAll(page, limit);
  }

  @Get(':id')
  findTaxType(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TaxTypeResponseDto> {
    return this.taxTypesService.findById(id);
  }

  @Post()
  createTaxType(
    @Body() body: CreateTaxTypeDto,
  ): Promise<TaxTypeResponseDto> {
    return this.taxTypesService.create(body);
  }

  @Patch(':id')
  updateTaxType(
    @Param('id', ParseIntPipe) id: number,
    @Body() changes: UpdateTaxTypeDto,
  ): Promise<TaxTypeResponseDto> {
    return this.taxTypesService.update(id, changes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTaxType(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.taxTypesService.delete(id);
  }
}