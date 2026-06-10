# Auth — Seguridad completa

Este documento cubre cómo funciona todo el sistema de autenticación y autorización: módulo, estrategias, guards, decoradores y controller.

---

## 1. El módulo (`auth.module.ts`)

```ts
@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    TypeOrmModule.forFeature([TokenEntity, RefreshTokenEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) => ({
        secret: configService.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
})
export class AuthModule {}
```

**Puntos clave:**

- `PassportModule` registra el sistema de estrategias de Passport en el DI container de Nest.
- `JwtModule.registerAsync` carga el secret desde las variables de entorno (nunca hardcodeado). Los access tokens duran **15 minutos**.
- `LocalStrategy` y `JwtStrategy` se registran como providers — eso es lo que las hace disponibles como `AuthGuard('local')` y `AuthGuard('jwt')` en el controller.
- `TypeOrmModule.forFeature([TokenEntity, RefreshTokenEntity])` inyecta los repos de tokens de email y refresh tokens respectivamente.

---

## 2. Estrategias de Passport

Passport funciona con **estrategias**: cada estrategia define cómo validar una credencial. El resultado de `validate()` se pone en `req.user`.

### LocalStrategy — valida email + password en el login

```ts
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string) {
    return this.authService.validateUser(email, password);
  }
}
```

- `PassportStrategy(Strategy, 'local')` → registra esta estrategia con el nombre `'local'`, que es lo que se usa en `AuthGuard('local')`.
- `super({ usernameField: 'email' })` → por defecto Passport busca `username` en el body; esto le dice que use `email`.
- `validate()` llama a `validateUser()` del service, que hace bcrypt + chequeo de `isActive`. Si lanza excepción, Passport devuelve 401 automáticamente. Si devuelve el usuario, Passport lo pone en `req.user`.

### JwtStrategy — valida el Bearer token en requests autenticados

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService<Env>) {
    const secret = configService.get('JWT_SECRET', { infer: true });
    if (!secret) throw new Error('JWT_SECRET is not set');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: Payload) {
    return payload; // queda disponible como req.user = { sub, role }
  }
}
```

- `fromAuthHeaderAsBearerToken()` → extrae el token del header `Authorization: Bearer <token>`.
- `ignoreExpiration: false` → si el token expiró, Passport rechaza con 401 automáticamente.
- `validate()` recibe el payload ya decodificado y verificado — Passport se encarga de verificar la firma y expiración antes de llamarlo. Lo que retorne `validate()` se convierte en `req.user`.
- El payload es `{ sub: userId, role: RoleType }`. Al retornarlo directo, `req.user` queda con esos datos — sin query a la DB.

### El payload del JWT

```ts
export interface Payload {
  sub: number;       // userId
  role: RoleType | null;
}
```

El rol viaja dentro del JWT para evitar una query a la DB en cada request. Si el rol del usuario cambia, el access token viejo sigue siendo válido hasta que expire (15 min máximo).

---

## 3. Guards

### AuthGuard('jwt') y AuthGuard('local') — de Passport

Son guards generados automáticamente por `@nestjs/passport`. Se usan así en el controller:

```ts
@UseGuards(AuthGuard('jwt'))   // valida el Bearer token
@UseGuards(AuthGuard('local')) // valida email + password del body
```

Cuando se aplica `AuthGuard('jwt')`:
1. Extrae el token del header.
2. Verifica firma y expiración con el secret.
3. Llama a `JwtStrategy.validate()` → pone el resultado en `req.user`.
4. Si falla cualquier paso → 401 automático.

### RolesGuard — autorización por rol

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lee los roles requeridos del metadata del handler o de la clase
    const requiredRoles =
      this.reflector.get<RoleType[]>('roles', context.getHandler()) ??
      this.reflector.get<RoleType[]>('roles', context.getClass());

    // Sin @Roles() → ruta pública, pasa
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const payload = request.user as { sub: number; role: RoleType | null };

    if (!payload?.role) throw new ForbiddenException('Access denied');
    if (!requiredRoles.includes(payload.role)) throw new ForbiddenException('Access denied');

    return true;
  }
}
```

- `Reflector` lee el metadata que puso `@Roles()` en el método o en la clase.
- Busca primero en el handler (`context.getHandler()`) y si no hay, en la clase (`context.getClass()`). Eso permite poner `@Roles()` a nivel de clase y que aplique a todos los endpoints.
- Lee `payload.role` de `req.user` — que ya lo puso `JwtStrategy.validate()`. Sin query a la DB.
- Devuelve `ForbiddenException` (403) si el rol no alcanza, no 401. La diferencia: 401 = no autenticado, 403 = autenticado pero sin permiso.

**Orden crítico al combinar guards:**

```ts
@UseGuards(AuthGuard('jwt'), RolesGuard)
```

Siempre `AuthGuard('jwt')` primero. Si va al revés, `RolesGuard` intentaría leer `req.user` antes de que `JwtStrategy` lo haya puesto, y siempre daría 403.

---

## 4. Decoradores custom

### @Roles()

```ts
export const Roles = (...roles: RoleType[]) => SetMetadata('roles', roles);
```

`SetMetadata` adjunta metadata al handler o clase con la clave `'roles'`. El `RolesGuard` la lee después con `Reflector`. Uso:

```ts
@Roles(RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Get()
findAll() { ... }
```

### @CurrentUser()

```ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
```

Extrae `req.user` y lo inyecta como parámetro del método del controller. Requiere que `AuthGuard('jwt')` ya haya corrido (que es quien pone `req.user`). Uso:

```ts
@UseGuards(AuthGuard('jwt'))
@Get('profile')
getProfile(@CurrentUser() user: JwtPayload) {
  // user.sub → userId
  // user.role → RoleType
}
```

---

## 5. El controller — endpoints y sus patrones de seguridad

```ts
@Controller({ version: '1', path: 'auth' })
export class AuthController {

  // Sin guard → público
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: CreateUserDto) { ... }

  // Sin guard → público (el token en query param es la "llave")
  @Get('activate')
  async activate(@Query('token') token: string) { ... }

  // AuthGuard('local') → Passport valida email+password antes de entrar al método
  // El usuario validado queda en req.user → se accede con @Req()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: Request) {
    const user = req.user as UserEntity; // puesto por LocalStrategy.validate()
    return this.authService.login(user);
  }

  // Sin guard → el refresh token en el body ES la credencial
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) { ... }

  // Sin guard → el refresh token en el body ES la credencial
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) { ... }

  // Throttle agresivo → 3 intentos por minuto para evitar spam
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) { ... }

  // AuthGuard('jwt') → requiere estar autenticado
  // @CurrentUser() extrae el userId del JWT → no hace query a DB
  @UseGuards(AuthGuard('jwt'))
  @Patch('change-password')
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto);
  }

  // AuthGuard('jwt') → requiere estar autenticado
  @UseGuards(AuthGuard('jwt'))
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: JwtPayload) {
    return this.authService.logoutAll(user.sub);
  }
}
```

**Por qué `logout` y `refresh` no tienen `AuthGuard('jwt')`:**
El access token dura 15 minutos. Si ya expiró, el cliente no podría hacer logout ni refresh — quedaría bloqueado. La credencial de estas rutas ES el refresh token en el body, y el service lo valida manualmente (hash + revocación + expiración).

---

## 6. Flujo completo de una request autenticada

```
Cliente envía:  GET /v1/products  →  Authorization: Bearer eyJhbGc...

1. AuthGuard('jwt') intercepta la request
2. JwtStrategy extrae el token del header
3. Verifica firma con JWT_SECRET → si inválida: 401
4. Verifica expiración → si expirado: 401
5. Llama a JwtStrategy.validate(payload) → retorna { sub: 42, role: 'admin' }
6. Passport pone { sub: 42, role: 'admin' } en req.user
7. RolesGuard lee @Roles() del handler via Reflector
8. Compara payload.role con los roles requeridos → si no coincide: 403
9. El método del controller ejecuta
10. @CurrentUser() extrae req.user → el controller recibe { sub: 42, role: 'admin' }
```

---

## 7. Decisiones de seguridad notables

| Decisión | Por qué |
|---|---|
| Password se verifica ANTES de chequear `isActive` | Evita revelar si la cuenta existe |
| Mismo mensaje para "user no existe" y "password incorrecta" | Previene enumeración de emails |
| Refresh token guardado como SHA-256 hash | Si la DB se filtra, los tokens son inutilizables |
| El raw token solo existe en memoria y en la respuesta al cliente | Nunca se puede recuperar de la DB |
| Rol en el JWT payload | Evita una DB query por request en cada chequeo de autorización |
| `forgot-password` siempre responde OK | No da pistas sobre si el email está registrado |
| `logout`/`refresh` sin `AuthGuard('jwt')` | El access token puede haber expirado — el refresh token ES la credencial |
| `@Throttle` en register/login/forgot | Limita ataques de fuerza bruta |
