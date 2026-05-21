import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Patch,
  Delete,
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

import { ComboTaxesService } from '../services/combo-taxes.service';
import { CreateComboTaxDto } from '../dto/create-combo-taxes.dto';
import { UpdateComboTaxDto } from '../dto/update-combo-taxes.dto';
import { ComboTaxResponseDto } from '../dto/combo-taxes-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Combo Taxes')
@ApiBearerAuth()
@ApiParam({ name: 'comboId', type: Number })
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('combos/:comboId/taxes')
export class ComboTaxesController {
  constructor(private readonly comboTaxesService: ComboTaxesService) {}

  @ApiOperation({ summary: 'List taxes for a combo' })
  @ApiResponse({ status: 200, type: [ComboTaxResponseDto] })
  @Get()
  findAll(
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<ComboTaxResponseDto[]> {
    return this.comboTaxesService.findAll(comboId);
  }

  @ApiOperation({ summary: 'Get a combo tax by ID' })
  @ApiResponse({ status: 200, type: ComboTaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ComboTaxResponseDto> {
    return this.comboTaxesService.findOne(id);
  }

  @ApiOperation({ summary: 'Assign a tax to a combo' })
  @ApiResponse({ status: 201, type: ComboTaxResponseDto })
  @ApiResponse({ status: 400, description: 'Tax not found or is global' })
  @Post()
  create(
    @Param('comboId', ParseIntPipe) comboId: number,
    @Body() dto: CreateComboTaxDto,
  ): Promise<ComboTaxResponseDto> {
    return this.comboTaxesService.create({ ...dto, comboId });
  }

  @ApiOperation({ summary: 'Update a combo tax assignment' })
  @ApiResponse({ status: 200, type: ComboTaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComboTaxDto,
  ): Promise<ComboTaxResponseDto> {
    return this.comboTaxesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Remove a tax from a combo' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.comboTaxesService.remove(id);
  }
}
