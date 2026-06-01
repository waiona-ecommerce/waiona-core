import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { UserEntity } from '../../users/entities/user.entity';
import { RoleEntity } from '../../users/entities/role.entity';
import { RoleType } from '../../../common/enums/role-type.enum';
import { Env } from '../../../env.model';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,

    private readonly configService: ConfigService<Env>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRoles();
    await this.seedSuperAdmin();
  }

  // ==========================
  // SEED ROLES
  // Crea los tres roles base si no existen
  // ==========================

  private async seedRoles() {
    for (const type of Object.values(RoleType)) {
      const existing = await this.roleRepo.findOne({ where: { type } });
      if (!existing) {
        await this.roleRepo.save(this.roleRepo.create({ type }));
      }
    }
  }

  // ==========================
  // SEED SUPERADMIN
  // ==========================

  private async seedSuperAdmin() {
    const existing = await this.userRepo.findOne({
      where: { role: { type: RoleType.SUPER_ADMIN } },
    });
    if (existing) return;

    const role = await this.roleRepo.findOne({
      where: { type: RoleType.SUPER_ADMIN },
    });

    const profile = { name: 'Super', lastName: 'Admin' };

    const email = this.configService.get('SUPERADMIN_EMAIL', { infer: true })!;
    const password = this.configService.get('SUPERADMIN_PASSWORD', {
      infer: true,
    })!;

    const user = this.userRepo.create({
      email,
      password,
      isActive: true,
      profile,
      role: role!,
    });

    await this.userRepo.save(user);
  }
}
