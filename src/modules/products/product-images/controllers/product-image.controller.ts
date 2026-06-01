import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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

import { ProductImageService } from '../services/product-image.service';
import { CreateProductImageDto } from '../dto/create-product-image.dto';
import { UpdateProductImageDto } from '../dto/update-product-image.dto';
import { UploadProductImageDto } from '../dto/upload-product-image.dto';
import { ProductImageResponseDto } from '../dto/product-image-response.dto';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../common/enums/role-type.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../common/guards/roles.guard';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@ApiTags('Product Images')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'product-images' })
export class ProductImageController {
  constructor(private readonly productImageService: ProductImageService) {}

  // ==========================
  // UPLOAD (multipart → Cloudinary)
  // ==========================

  @Post('upload')
  @ApiOperation({ summary: 'Subir imagen de producto a Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'productId', 'position'],
      properties: {
        file: { type: 'string', format: 'binary' },
        productId: { type: 'integer' },
        position: { type: 'integer' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Imagen subida',
    type: ProductImageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o datos faltantes',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
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
    @Body() dto: UploadProductImageDto,
  ): Promise<ProductImageResponseDto> {
    if (!file) throw new BadRequestException('El archivo es requerido');
    return this.productImageService.uploadImage(file, dto);
  }

  // ==========================
  // CREATE (URL manual)
  // ==========================

  @Post()
  @ApiOperation({ summary: 'Agregar imagen a un producto (URL externa)' })
  @ApiResponse({
    status: 201,
    description: 'Imagen creada',
    type: ProductImageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  create(@Body() dto: CreateProductImageDto): Promise<ProductImageResponseDto> {
    return this.productImageService.create(dto);
  }

  // ==========================
  // GET ALL BY PRODUCT
  // ==========================

  @Get('product/:productId')
  @ApiOperation({ summary: 'Listar imágenes de un producto' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imágenes del producto',
    type: ProductImageResponseDto,
    isArray: true,
  })
  findByProduct(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<ProductImageResponseDto[]> {
    return this.productImageService.findByProduct(productId);
  }

  // ==========================
  // GET BY ID
  // ==========================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener imagen por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imagen encontrada',
    type: ProductImageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductImageResponseDto> {
    return this.productImageService.findOne(id);
  }

  // ==========================
  // UPDATE
  // ==========================

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar imagen (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Imagen actualizada',
    type: ProductImageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    return this.productImageService.update(id, dto);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar imagen (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Imagen eliminada' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productImageService.remove(id);
  }
}
