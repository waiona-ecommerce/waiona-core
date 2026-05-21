import { PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export abstract class BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;
}
