import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ComboImageEntity } from '../entities/combo-image.entity';
import { ComboEntity } from '../../combos/entities/combo.entity';

import { CreateComboImageDto } from '../dto/create-combo-image.dto';
import { UpdateComboImageDto } from '../dto/update-combo-image.dto';
import { ComboImageResponseDto } from '../dto/combo-image-response.dto';

@Injectable()
export class ComboImageService {
  constructor(
    @InjectRepository(ComboImageEntity)
    private readonly comboImageRepository: Repository<ComboImageEntity>,

    @InjectRepository(ComboEntity)
    private readonly comboRepository: Repository<ComboEntity>,
  ) {}

  // ==========================
  // CREATE
  // ==========================

  async create(dto: CreateComboImageDto): Promise<ComboImageResponseDto> {
    const combo = await this.comboRepository.findOne({
      where: { id: dto.comboId },
    });

    if (!combo) {
      throw new NotFoundException(`Combo with id ${dto.comboId} not found`);
    }

    const image = this.comboImageRepository.create(dto);

    const saved = await this.comboImageRepository.save(image);

    return new ComboImageResponseDto(saved);
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
    const merged = this.comboImageRepository.merge(image, dto);
    const updated = await this.comboImageRepository.save(merged);
    return new ComboImageResponseDto(updated);
  }

  // ==========================
  // DELETE (soft)
  // ==========================

  async remove(id: number): Promise<void> {
    const image = await this.findEntity(id);
    await this.comboImageRepository.softDelete(image.id);
  }

  // ==========================
  // PRIVATE
  // ==========================

  private async findEntity(id: number): Promise<ComboImageEntity> {
    const image = await this.comboImageRepository.findOne({ where: { id } });
    if (!image)
      throw new NotFoundException(`ComboImage with id ${id} not found`);
    return image;
  }
}
