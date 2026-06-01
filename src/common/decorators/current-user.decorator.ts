import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoleType } from '../enums/role-type.enum';

export interface JwtPayload {
  sub: number;
  role: RoleType;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
