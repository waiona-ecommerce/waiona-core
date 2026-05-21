import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { ComboImageService } from '../services/combo-image.service';
import { CreateComboImageDto } from '../dto/create-combo-image.dto';
import { UpdateComboImageDto } from '../dto/update-combo-image.dto';
import { ComboImageResponseDto } from '../dto/combo-image-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Combo Images')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('combo-images')
export class ComboImageController {
  constructor(private readonly comboImageService: ComboImageService) {}

  // ==========================
  // CREATE
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Agregar imagen a un combo' })
  @ApiResponse({
    status: 201,
    description: 'Imagen creada',
    type: ComboImageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Combo no encontrado' })
  create(@Body() dto: CreateComboImageDto): Promise<ComboImageResponseDto> {
    return this.comboImageService.create(dto);
  }

  // ==========================
  // GET ALL BY COMBO
  // ==========================

  @Get('/combo/:comboId')
  @ApiOperation({ summary: 'Listar imágenes de un combo' })
  @ApiParam({ name: 'comboId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imágenes del combo',
    type: ComboImageResponseDto,
    isArray: true,
  })
  findByCombo(
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<ComboImageResponseDto[]> {
    return this.comboImageService.findByCombo(comboId);
  }

  // ==========================
  // GET BY ID
  // ==========================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener imagen de combo por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imagen encontrada',
    type: ComboImageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ComboImageResponseDto> {
    return this.comboImageService.findOne(id);
  }

  // ==========================
  // UPDATE
  // ==========================

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar imagen de combo (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imagen actualizada',
    type: ComboImageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComboImageDto,
  ): Promise<ComboImageResponseDto> {
    return this.comboImageService.update(id, dto);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar imagen de combo (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Imagen eliminada' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.comboImageService.remove(id);
  }
}
