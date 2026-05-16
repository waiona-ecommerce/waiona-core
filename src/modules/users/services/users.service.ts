import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, DataSource } from 'typeorm';

import { UserEntity } from '../entities/user.entity';
import { ProfileEntity } from '../entities/profile.entity';
import { RoleEntity } from '../entities/role.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { SearchUsersDto } from '../dto/search-users.dto';
import { RoleType } from 'src/common/enums/role-type.enum';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(ProfileEntity)
    private readonly profileRepo: Repository<ProfileEntity>,

    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,

    private readonly dataSource: DataSource,
  ) {}

  /* =======================
      CREATE
  ======================= */
  async create(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const clientRole = await this.roleRepo.findOne({
      where: { type: RoleType.CLIENT },
    });

    // 🔥 transacción — si falla el save del user el profile no queda huérfano
    return this.dataSource.transaction(async manager => {

      const profile = manager.create(ProfileEntity, {
        name:     dto.name,
        lastName: dto.lastName,
        avatar:   dto.avatar ?? null,
      });

      const user = manager.create(UserEntity, {
        email:    dto.email,
        password: dto.password,
        profile,
        role:     clientRole ?? undefined,
      });

      try {
        return await manager.save(UserEntity, user);
      } catch (err: any) {
        if (err.code === '23505') throw new ConflictException('Email already in use');
        throw err;
      }
    });
  }

  /* =======================
      FIND
  ======================= */

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { email },
    });
  }

  async findAll(dto?: SearchUsersDto, page = 1, limit = 20): Promise<PaginatedResponseDto<UserEntity>> {
    const skip = (page - 1) * limit;

    if (dto?.name) {
      const where = [
        { ...(dto.email && { email: ILike(`%${dto.email}%`) }), profile: { name: ILike(`%${dto.name}%`) } },
        { ...(dto.email && { email: ILike(`%${dto.email}%`) }), profile: { lastName: ILike(`%${dto.name}%`) } },
      ];
      const [users, total] = await this.userRepo.findAndCount({ where, skip, take: limit });
      return new PaginatedResponseDto(users, total, page, limit);
    }

    const where: any = {};
    if (dto?.email) where.email = ILike(`%${dto.email}%`);

    const [users, total] = await this.userRepo.findAndCount({ where, skip, take: limit });
    return new PaginatedResponseDto(users, total, page, limit);
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /* =======================
      UPDATE
  ======================= */
  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    Object.assign(user.profile, {
      name:     dto.name     ?? user.profile.name,
      lastName: dto.lastName ?? user.profile.lastName,
      avatar:   dto.avatar   ?? user.profile.avatar,
    });

    return this.userRepo.save(user);
  }

  /* =======================
      DELETE (SOFT)
  ======================= */
  async remove(id: number) {
    const user = await this.findOne(id);
    return this.userRepo.softRemove(user);
  }

  /* =======================
      ACTIVATE
  ======================= */
  async activate(id: number): Promise<void> {
    await this.userRepo.update(id, { isActive: true });
  }

  /* =======================
      UPDATE PASSWORD
  ======================= */
  async updatePassword(id: number, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(id, { password: hashed });
  }
}