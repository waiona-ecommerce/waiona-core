import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, QueryFailedError } from 'typeorm';

import { ComboImageEntity } from '../entities/combo-image.entity';
import { ComboEntity } from '../../combos/entities/combo.entity';

import { CreateComboImageDto } from '../dto/create-combo-image.dto';
import { UpdateComboImageDto } from '../dto/update-combo-image.dto';
import { UploadComboImageDto } from '../dto/upload-combo-image.dto';
import { ComboImageResponseDto } from '../dto/combo-image-response.dto';
import { StorageService } from '../../../storage/storage.service';

@Injectable()
export class ComboImageService {
  constructor(
    @InjectRepository(ComboImageEntity)
    private readonly comboImageRepository: Repository<ComboImageEntity>,

    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,

    private readonly storageService: StorageService,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateComboImageDto): Promise<ComboImageResponseDto> {
    const combo = await this.comboRepository.findOne({
      where: { id: dto.comboId },
    });

    if (!combo) {
      throw new NotFoundException(`Combo con id ${dto.comboId} no encontrado`);
    }

    await this.assertPositionFree(dto.comboId, dto.position);

    try {
      const image = this.comboImageRepository.create(dto);
      const saved = await this.comboImageRepository.save(image);
      return new ComboImageResponseDto(saved);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe una imagen en la posición ${dto.position} para este combo`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // GET ALL BY COMBO
  // ==========================

  async findByCombo(comboId: number): Promise<ComboImageResponseDto[]> {
    const images = await this.comboImageRepository.find({
      where: { comboId },
      order: { position: 'ASC' },
    });

    return images.map((image) => new ComboImageResponseDto(image));
  }

  // ==========================
  // GET BY ID
  // ==========================

  async findOne(id: number): Promise<ComboImageResponseDto> {
    return new ComboImageResponseDto(await this.findEntity(id));
  }

  // ==========================
  // UPDATE
  // ==========================

  async update(
    id: number,
    dto: UpdateComboImageDto,
  ): Promise<ComboImageResponseDto> {
    const image = await this.findEntity(id);

    if (dto.position !== undefined && dto.position !== image.position) {
      await this.assertPositionFree(image.comboId, dto.position, id);
    }

    const merged = this.comboImageRepository.merge(image, dto);

    try {
      const updated = await this.comboImageRepository.save(merged);
      return new ComboImageResponseDto(updated);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe una imagen en la posición ${dto.position} para este combo`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // UPLOAD (multipart → Cloudinary)
  // ==========================

  async uploadImage(
    file: Express.Multer.File,
    dto: UploadComboImageDto,
  ): Promise<ComboImageResponseDto> {
    const combo = await this.comboRepository.findOne({
      where: { id: dto.comboId },
    });
    if (!combo) {
      throw new NotFoundException(`Combo con id ${dto.comboId} no encontrado`);
    }

    await this.assertPositionFree(dto.comboId, dto.position);

    const { url, publicId } = await this.storageService.upload(
      file,
      'waiona/combos',
    );

    const stillExists = await this.comboRepository.findOne({
      where: { id: dto.comboId },
    });
    if (!stillExists) {
      await this.storageService.delete(publicId).catch(() => undefined);
      throw new NotFoundException(`Combo con id ${dto.comboId} no encontrado`);
    }

    try {
      await this.assertPositionFree(dto.comboId, dto.position);
      const image = this.comboImageRepository.create({
        comboId: dto.comboId,
        position: dto.position,
        url,
        publicId,
      });
      const saved = await this.comboImageRepository.save(image);
      return new ComboImageResponseDto(saved);
    } catch (err) {
      await this.storageService.delete(publicId).catch(() => undefined);
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          `Ya existe una imagen en la posición ${dto.position} para este combo`,
        );
      }
      throw err;
    }
  }

  // ==========================
  // DELETE (soft + Cloudinary)
  // ==========================

  async remove(id: number): Promise<void> {
    const image = await this.findEntity(id);
    await this.comboImageRepository.softDelete(image.id);
    if (image.publicId) {
      await this.storageService.delete(image.publicId).catch(() => undefined);
    }
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findEntity(id: number): Promise<ComboImageEntity> {
    const image = await this.comboImageRepository.findOne({ where: { id } });
    if (!image)
      throw new NotFoundException(`Imagen de combo con id ${id} no encontrada`);
    return image;
  }

  private async assertPositionFree(
    comboId: number,
    position: number,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.comboImageRepository.findOne({
      where:
        excludeId !== undefined
          ? { comboId, position, id: Not(excludeId) }
          : { comboId, position },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe una imagen en la posición ${position} para este combo`,
      );
    }
  }
}
