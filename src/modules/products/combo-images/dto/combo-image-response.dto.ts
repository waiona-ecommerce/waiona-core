import { ComboImageEntity } from '../entities/combo-image.entity';

export class ComboImageResponseDto {
  id: number;
  comboId: number;
  url: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(entity: ComboImageEntity) {
    this.id = entity.id;
    this.comboId = entity.comboId;
    this.url = entity.url;
    this.position = entity.position;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
