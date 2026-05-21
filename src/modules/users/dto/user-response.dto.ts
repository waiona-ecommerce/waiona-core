import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../entities/user.entity';
import { RoleType } from 'src/common/enums/role-type.enum';

export class ProfileResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Juan' })
  name: string;

  @ApiProperty({ example: 'Pérez' })
  lastName: string;

  @ApiProperty({ example: null, nullable: true })
  avatar: string | null;

  constructor(profile: {
    id: number;
    name: string;
    lastName: string;
    avatar?: string | null;
  }) {
    this.id = profile.id;
    this.name = profile.name;
    this.lastName = profile.lastName;
    this.avatar = profile.avatar ?? null;
  }
}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'juan@example.com' })
  email: string;

  @ApiProperty({ example: false })
  isActive: boolean;

  @ApiProperty({ enum: RoleType, nullable: true })
  role: RoleType | null;

  @ApiProperty({ type: ProfileResponseDto })
  profile: ProfileResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: UserEntity) {
    this.id = entity.id;
    this.email = entity.email;
    this.isActive = entity.isActive;
    this.role = entity.role?.type ?? null;
    this.profile = new ProfileResponseDto(entity.profile);
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
