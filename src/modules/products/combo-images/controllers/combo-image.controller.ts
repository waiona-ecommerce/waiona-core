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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { ComboImageService } from '../services/combo-image.service';
import { CreateComboImageDto } from '../dto/create-combo-image.dto';
import { UpdateComboImageDto } from '../dto/update-combo-image.dto';
import { UploadComboImageDto } from '../dto/upload-combo-image.dto';
import { ComboImageResponseDto } from '../dto/combo-image-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@ApiTags('Combo Images')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'combo-images' })
export class ComboImageController {
  constructor(private readonly comboImageService: ComboImageService) {}

  // ==========================
  // UPLOAD (multipart → Cloudinary)
  // ==========================

  @Post('upload')
  @ApiOperation({ summary: 'Subir imagen de combo a Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'comboId', 'position'],
      properties: {
        file: { type: 'string', format: 'binary' },
        comboId: { type: 'integer' },
        position: { type: 'integer' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Imagen subida',
    type: ComboImageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o datos faltantes',
  })
  @ApiResponse({ status: 404, description: 'Combo no encontrado' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes (jpeg, png, webp, gif)',
            ),
            false,
          );
        }
      },
    }),
  )
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadComboImageDto,
  ): Promise<ComboImageResponseDto> {
    if (!file) throw new BadRequestException('El archivo es requerido');
    return this.comboImageService.uploadImage(file, dto);
  }

  // ==========================
  // CREATE (URL manual)
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Agregar imagen a un combo (URL externa)' })
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

  @Get('combo/:comboId')
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
