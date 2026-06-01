import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '../enums/role-type.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.get<RoleType[]>('roles', context.getHandler()) ??
      this.reflector.get<RoleType[]>('roles', context.getClass());

    // Si no tiene @Roles() → ruta pública
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const payload = request.user as { sub: number; role: RoleType | null };

    if (!payload?.role) {
      throw new ForbiddenException('Access denied');
    }

    if (!requiredRoles.includes(payload.role)) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
