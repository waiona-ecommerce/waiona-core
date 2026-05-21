---
name: nestjs-auth-jwt
description: >
  JWT authentication patterns for this repo using Passport, LocalStrategy, JwtStrategy, RolesGuard and full auth flow (register, activate, forgot/reset password).
  Load when implementing login, protecting routes, working with guards, roles, or the auth module.
metadata:
  author: @rodrigozucchini
  version: "4.0"
---

# NestJS Auth JWT Skill

---

## When to Use

Load when implementing login, register, account activation, password reset, protecting routes with JWT, or modifying `AuthModule`, `AuthService`, guards or strategies.
Skip for general module structure (use `nestjs-core`) or user CRUD unrelated to auth.

---

## Repo Rules

1. Two strategies: `local` for login only, `jwt` for all protected routes.
2. JWT payload is `{ sub: userId, role: RoleType }` — always includes role.
3. `JwtStrategy.validate()` returns the full payload — downstream uses `req.user as { sub: number; role: RoleType }`.
4. `JWT_SECRET` always via `ConfigService<Env>` — never `process.env`.
5. Password excluded via `@Exclude()` on entity + `ClassSerializerInterceptor` globally in `main.ts`.
6. `RolesGuard` reads role from JWT payload — **never queries the DB**.
7. `validateUser()` checks `isActive` — inactive accounts get `401`.

---

## Auth Flow

```
POST /auth/register { email, password, name, lastName }
  → UsersService.create() → user created with isActive: false
  → TokenEntity created (type: ACCOUNT_ACTIVATION, expires 24h)
  → MailService.sendActivationEmail()

GET /auth/activate?token=xxx
  → TokenEntity validated (not used, not expired)
  → UsersService.activate(userId) → isActive: true
  → Token marked as used

POST /auth/login { email, password }
  → AuthGuard('local') → LocalStrategy → AuthService.validateUser()
  → bcrypt.compare() + check isActive
  → generateToken() → { sub: user.id, role: user.role.type }
  → Response: { user, access_token }

POST /auth/forgot-password { email }
  → silently returns OK if user not found (no hints to attacker)
  → TokenEntity created (type: PASSWORD_RESET, expires 1h)
  → MailService.sendPasswordResetEmail()

POST /auth/reset-password { token, password }
  → TokenEntity validated
  → UsersService.updatePassword() → bcrypt.hash(10)
  → Token marked as used

POST /auth/login { email, password }
  → returns { user, access_token (15min), refresh_token (opaque 64-char hex, 30 days) }
  → refresh_token stored in DB as SHA-256 hash (RefreshTokenEntity)

POST /auth/refresh { refresh_token }
  → hash raw token, look up RefreshTokenEntity
  → validate: not revoked, not expired
  → revoke old token (revokedAt = NOW())
  → create new RefreshTokenEntity → return new pair { access_token, refresh_token }

POST /auth/logout { refresh_token }
  → hash raw token, find RefreshTokenEntity
  → set revokedAt = NOW() → 200 OK

PATCH /auth/change-password { currentPassword, newPassword }  — requires JWT
  → bcrypt.compare(currentPassword, user.password)
  → if mismatch → 400 Bad Request
  → bcrypt.hash(newPassword, 10) → save → 200 OK
  → diferencia con reset-password: este flujo requiere conocer el password actual

POST /auth/logout-all  — requires JWT
  → revoca todos los RefreshTokenEntity del usuario donde revokedAt IS NULL
  → el access token actual sigue válido hasta que expira (15min by design)
  → útil cuando el usuario sospecha que su cuenta fue comprometida

Protected route:
  Authorization: Bearer <access_token>
  → AuthGuard('jwt') → JwtStrategy.validate(payload)
  → req.user = { sub: userId, role: RoleType }
```

---

## JWT Payload

```typescript
// models/payload.model.ts
import { RoleType } from 'src/common/enums/role-type.enum';

export interface Payload {
  sub: number;
  role: RoleType | null;
}
```

---

## RolesGuard — reads from token, no DB query

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.get<RoleType[]>('roles', context.getHandler()) ??
      this.reflector.get<RoleType[]>('roles', context.getClass());

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const payload = request.user as { sub: number; role: RoleType | null };

    if (!payload?.role) throw new ForbiddenException('Access denied');
    if (!requiredRoles.includes(payload.role)) throw new ForbiddenException('Access denied');

    return true;
  }
}
```

---

## Protecting Routes

```typescript
// Endpoint público (shop, registro)
@Post('register')
register(@Body() dto: CreateUserDto) { ... }

// Solo autenticado (cualquier rol)
@UseGuards(AuthGuard('jwt'))
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
  const payload = req.user as { sub: number; role: RoleType };
}

// Solo admin — a nivel de clase
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('products')
export class ProductController { ... }

// Solo admin — en método específico
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(RolesGuard)
@Patch(':id/status')
updateStatus() { ... }
```

---

## Ownership Check (cliente solo ve sus propios datos)

```typescript
@UseGuards(AuthGuard('jwt'))
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
  const payload = req.user as { sub: number; role: RoleType };
  if (payload.role === RoleType.CLIENT && payload.sub !== id) {
    throw new ForbiddenException('Access denied');
  }
  return this.service.findOne(id);
}
```

---

## Token Entity

```typescript
export enum TokenType {
  ACCOUNT_ACTIVATION = 'account_activation',
  PASSWORD_RESET     = 'password_reset',
}

@Entity('tokens')
export class TokenEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  token: string;

  @Column({ type: 'enum', enum: TokenType, nullable: false })
  type: TokenType;

  @Column({ name: 'user_id', type: 'int', nullable: false })
  userId: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  get isExpired(): boolean { return new Date() > this.expiresAt; }
  get isUsed(): boolean { return this.usedAt !== null; }
}
```

---

## RefreshTokenEntity

```typescript
@Entity('refresh_tokens')
export class RefreshTokenEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  token: string; // SHA-256 hash of the raw token sent to the client

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  get isExpired(): boolean { return new Date() > this.expiresAt; }
  get isRevoked(): boolean { return this.revokedAt !== null; }
}
```

**Rotation rules:**
- Raw token = `randomBytes(32).toString('hex')` → 64-char hex
- Stored token = `createHash('sha256').update(rawToken).digest('hex')`
- On `/auth/refresh`: old `RefreshTokenEntity` is revoked, new one created atomically
- On `/auth/logout`: token revoked, no new token issued

---

## Roles Enum

```typescript
// src/common/enums/role-type.enum.ts
export enum RoleType {
  SUPER_ADMIN = 'super_admin',
  ADMIN       = 'admin',
  CLIENT      = 'client',
}
```

---

## Common Mistakes

- Putting `AuthGuard('local')` outside login — it expects `email` + `password` in body.
- **Putting only `{ sub }` in JWT payload** — always include `role` in this project.
- **Querying DB in `RolesGuard`** — read role from `req.user` (JWT payload), never the DB.
- Using `process.env.JWT_SECRET` directly — always use `ConfigService<Env>`.
- Forgetting `ClassSerializerInterceptor` in `main.ts` — `@Exclude()` won't work without it.
- Not checking `isActive` in `validateUser` — inactive users must get `401`.
- Forgetting ownership check for client role — clients should only access their own resources.
- **Storing raw refresh token in DB** — always store the SHA-256 hash; the raw token is sent to the client only once.
- **Not revoking old token on refresh** — rotation requires revoking the previous token before issuing a new one (do it in a single transaction).