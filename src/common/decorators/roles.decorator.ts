import { SetMetadata } from '@nestjs/common';
import { RoleType } from 'src/common/enums/role-type.enum';

export const Roles = (...roles: RoleType[]) => SetMetadata('roles', roles);
