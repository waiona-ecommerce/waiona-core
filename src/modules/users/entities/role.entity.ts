import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RoleType } from '../../../common/enums/role-type.enum';

@Entity('roles')
export class RoleEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: RoleType,
    unique: true,
  })
  type: RoleType;
}
